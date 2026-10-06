import {readFile,stat} from 'node:fs/promises';
import {Command} from 'commander';
import {z} from 'zod';
import {inspectPrepared,CAP} from './spending.js';
import {resolve} from 'node:path';
import {CreatorBudget} from './budget.js';
import {mainnetReader} from './mainnet-reader.js';
const input=z.object({serializedTransaction:z.string().max(1644),creator:z.string(),approvedRecipients:z.array(z.string()).max(20),quote:z.object({token:z.object({mintAddress:z.string(),symbol:z.string(),decimals:z.number().int()}).strict(),fundingAmount:z.string(),platformFee:z.object({percent:z.number(),amount:z.string()}).strict(),totalDebit:z.string()}).strict()}).strict();
const command=new Command().requiredOption('--file <path>','Local prepared quote/transaction and independently approved recipient policy').option('--rpc','Explicitly allow read-only mainnet RPC verification; no Gibwork requests or wallet prompts');
command.action(async(options:{file:string;rpc?:boolean})=>{
 if((await stat(options.file)).size>20000)throw new Error('Review input exceeds limit');
 const bytes=await readFile(options.file);if(bytes.length>20000)throw new Error('Review input exceeds limit');
 const parsed=input.parse(JSON.parse(bytes.toString('utf8')));
 const budget=new CreatorBudget(resolve('.escalate/creator-budget'),parsed.creator);
 const report=await inspectPrepared({...parsed,previousDebits:await budget.spent(),...(options.rpc?{reader:mainnetReader()}:{})});
 if(report.verified)await budget.reserve(report);
 // Reveal exact programs/recipients, but mask creator identity in ordinary terminal output.
 console.log(JSON.stringify({caps:{usdcBaseUnits:CAP.usdc.toString(),solLamports:CAP.sol.toString()},...report},null,2).replaceAll(parsed.creator,'[CREATOR]'));
 if(!report.verified)process.exitCode=1;
});
command.parseAsync().catch(()=>{console.error('Prepared review input failed. No signing or submission is possible.');process.exitCode=1;});
