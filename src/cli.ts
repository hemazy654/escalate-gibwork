#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { reportSchema, detect } from './core/failure.js';
import { scan } from './core/context.js';
import { brief } from './core/brief.js';
import { redact } from './core/redact.js';
import { fixtureSchema, mockGateway, taskInput } from './gibwork/gateway.js';
import { validate } from './validation/sandbox.js';
async function json(path:string) { if((await stat(path)).size>1000000) throw new Error('Input exceeds 1 MB limit'); const data = await readFile(path); if(data.length>1000000) throw new Error('Input exceeds 1 MB limit'); return JSON.parse(data.toString()) as unknown; }
function emit(value:unknown) { console.log(JSON.stringify(value,null,2)); }
function log(event:string) { console.error(JSON.stringify({level:'info',event,time:new Date().toISOString()})); }
const program = new Command().name('escalate').description('Safely hand repeated agent failures to a human').version('0.1.0');
for (const name of ['diagnose','create']) {
  const cmd = program.command(name).requiredOption('--report <path>','Failure report JSON').option('--repo <path>','Repository','.').option('--threshold <number>','Consecutive failure threshold','3');
  if(name==='create') cmd.requiredOption('--amount <decimal>','Proposed reward; never funded').requiredOption('--mint <address>','Proposed Solana token mint').option('--out <directory>','Private draft directory','.escalate');
  cmd.action(async (options:Record<string,string>)=>{
    const report = reportSchema.parse(await json(options.report!)); const failure=detect(report,Number(options.threshold));
    if(name==='diagnose') { emit({mode:'mock',failure,context:await scan(resolve(options.repo!),report)}); return; }
    if(!failure.escalate) throw new Error('Failure threshold not met; no bounty draft created');
    const draft=brief(report,await scan(resolve(options.repo!),report));
    const input=taskInput(draft.task,JSON.stringify(draft,null,2),options.amount!,options.mint!);
    const out=resolve(options.out!); await mkdir(out,{recursive:true,mode:0o700});
    const file=resolve(out,`${draft.digest}.json`);
    await writeFile(file,JSON.stringify({draft,gibworkInput:input,approvalRequired:true,financialOperationsEnabled:false},null,2),{flag:'wx',mode:0o600});
    log('draft.created'); emit({mode:'mock',file,digest:draft.digest,approvalRequired:true});
  });
}
program.command('review').argument('<task-id>').requiredOption('--fixtures <path>','Offline submission fixtures').option('--submission <id>','Submission to validate').option('--patch <path>','Maintainer-supplied local patch').option('--repo <path>','Repository','.').option('--baseline <sha>','Pinned baseline').option('--image <digest>','Preloaded trusted Docker image digest').option('--test-argv <json>','Test command JSON array').action(async (id:string, options:Record<string,string>)=>{
  const submissions=await mockGateway(fixtureSchema.parse(await json(options.fixtures!))).submissions(z.string().min(1).max(200).parse(id));
  if(!options.patch) {emit({mode:'mock',submissions});return;}
  const selected=submissions.find(s=>s.id===options.submission); if(!selected) throw new Error('Select a submission from the retrieved task');
  if(!options.baseline || !options.image || !options.testArgv) throw new Error('Patch validation requires --baseline, --image and --test-argv');
  const argv=z.array(z.string().min(1)).min(1).max(30).parse(JSON.parse(options.testArgv));
  const result=await validate(resolve(options.repo!),options.baseline,resolve(options.patch),options.image,argv);
  emit({mode:'mock',taskId:id,submissionId:selected.id,...result}); if(result.verdict==='FAIL')process.exitCode=1;
});
program.hook('preAction', () => { if (process.env.ESCALATE_MODE && process.env.ESCALATE_MODE !== 'mock') throw new Error('Only mock mode is supported'); });
program.parseAsync().catch((error:unknown)=>{ console.error(JSON.stringify({level:'error',event:'command.failed',message:redact(error instanceof z.ZodError ? 'Invalid input: '+error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ') : error instanceof Error ? error.message : 'Unknown error')})); process.exitCode=1; });
