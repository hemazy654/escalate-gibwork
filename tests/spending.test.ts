import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey,SystemProgram,TransactionInstruction,TransactionMessage,VersionedTransaction} from '@solana/web3.js';
import {inspectPrepared,USDC_MINT,TOKEN_PROGRAM,usdcUnits,type IndependentReader} from '../src/security/spending.js';
const creator=new PublicKey(new Uint8Array(32).fill(1)),source=new PublicKey(new Uint8Array(32).fill(2)),recipient=new PublicKey(new Uint8Array(32).fill(3));
const quote={token:{mintAddress:USDC_MINT,symbol:'USDC',decimals:6},fundingAmount:'1.00',platformFee:{percent:0,amount:'0'},totalDebit:'1.00'};
function transfer(amount=1000000n){const data=Buffer.alloc(10);data[0]=12;data.writeBigUInt64LE(amount,1);data[9]=6;return new TransactionInstruction({programId:new PublicKey(TOKEN_PROGRAM),keys:[{pubkey:source,isWritable:true,isSigner:false},{pubkey:new PublicKey(USDC_MINT),isWritable:false,isSigner:false},{pubkey:recipient,isWritable:true,isSigner:false},{pubkey:creator,isWritable:false,isSigner:true}],data});}
function encode(instructions:TransactionInstruction[]){return Buffer.from(new VersionedTransaction(new TransactionMessage({payerKey:creator,recentBlockhash:PublicKey.default.toBase58(),instructions}).compileToV0Message()).serialize()).toString('base64');}
// Independent account/fee data is mocked; these tests do not establish live-chain verification.
const reader:IndependentReader={assertMainnet:async()=>{},feeForMessage:async()=>5000n,tokenAccount:async address=>({program:TOKEN_PROGRAM,mint:USDC_MINT,owner:address===source.toBase58()?creator.toBase58():recipient.toBase58(),state:'initialized',delegate:null,closeAuthority:null})};
const options={serializedTransaction:encode([transfer()]),quote,creator:creator.toBase58(),approvedRecipients:[recipient.toBase58()],previousDebits:{usdc:0n,sol:0n},reader};
test('exact units and cumulative USDC/SOL caps are enforced without signature requests',async()=>{
 assert.equal(usdcUnits('1.50'),1500000n);assert.throws(()=>usdcUnits('0.0000001'));assert.throws(()=>usdcUnits('1e2'));
 const passed=await inspectPrepared(options);assert.equal(passed.verified,true);assert.equal(passed.signingAllowed,false);assert.deepEqual(passed.maximumDebit,{usdcBaseUnits:'1000000',solLamports:'5000'});
 assert.equal((await inspectPrepared({...options,previousDebits:{usdc:500001n,sol:0n}})).verified,false);
 assert.equal((await inspectPrepared({...options,previousDebits:{usdc:0n,sol:9995001n}})).verified,false);
 const withSol=encode([transfer(),SystemProgram.transfer({fromPubkey:creator,toPubkey:recipient,lamports:9995000n})]);
 assert.equal((await inspectPrepared({...options,serializedTransaction:withSol})).verified,true);
 assert.equal((await inspectPrepared({...options,serializedTransaction:encode([transfer(),SystemProgram.transfer({fromPubkey:creator,toPubkey:recipient,lamports:9995001n})])})).verified,false);
});
test('quote alone, malformed transactions, unknown recipients, wrong mint and mismatched amounts fail closed',async()=>{
 const {reader:_unused,...noRpc}=options;assert.equal((await inspectPrepared(noRpc)).verified,false);
 for(const value of [{...options,serializedTransaction:'garbage'},{...options,approvedRecipients:[]},{...options,serializedTransaction:encode([transfer(1000001n)])},{...options,quote:{...quote,totalDebit:'1.51',platformFee:{percent:51,amount:'0.51'}}},{...options,quote:{...quote,token:{...quote.token,mintAddress:PublicKey.default.toBase58()}}}]){
  const result=await inspectPrepared(value);assert.equal(result.verified,false);assert.equal(result.maximumDebit,null);assert.equal(result.signingAllowed,false);
 }
});
test('custom programs, rent/account creation, unchecked tokens and unavailable independent state are blocked',async()=>{
 const unknown=new TransactionInstruction({programId:recipient,keys:[],data:Buffer.alloc(0)});
 const unchecked=transfer();unchecked.data[0]=3;
 for(const ix of [unknown,unchecked,SystemProgram.createAccount({fromPubkey:creator,newAccountPubkey:recipient,lamports:1,space:1,programId:SystemProgram.programId})])assert.equal((await inspectPrepared({...options,serializedTransaction:encode([transfer(),ix])})).verified,false);
 for(const remote of [{...reader,feeForMessage:async()=>null},{...reader,assertMainnet:async()=>{throw new Error('Wrong cluster');}},{...reader,tokenAccount:async()=>({...await reader.tokenAccount(source.toBase58()),mint:PublicKey.default.toBase58()})}])assert.equal((await inspectPrepared({...options,reader:remote})).verified,false);
});

test('durable creator budget blocks repeat transactions and cumulative spending across instances',async()=>{
 const {CreatorBudget}=await import('../src/security/budget.js');
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'escalate-budget-'));
 try {
  const budget=new CreatorBudget(root,creator.toBase58());const report=await inspectPrepared(options);
  await budget.reserve(report);assert.deepEqual(await new CreatorBudget(root,creator.toBase58()).spent(),{usdc:1000000n,sol:5000n});
  await assert.rejects(budget.reserve(report),/already reserved/);
  await assert.rejects(budget.reserve({...report,transactionSha256:'f'.repeat(64)}),/cap exceeded/);
  await assert.rejects(budget.reserve({...report,verified:false}),/Unverified/);
  assert.deepEqual(await budget.spent(),{usdc:1000000n,sol:5000n});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('mainnet reader obtains independent mint/account/fee data using only allowlisted read RPC methods',async()=>{
 const {mainnetReader}=await import('../src/security/mainnet-reader.js');
 const original=globalThis.fetch;const calls:string[]=[];
 globalThis.fetch=async(input,init)=>{
  assert.equal(new URL(String(input)).href,'https://api.mainnet-beta.solana.com/');assert.equal(init?.redirect,'error');
  const body=JSON.parse(String(init?.body)) as {method:string;id:string;params:string[]};calls.push(body.method);
  let result:unknown;
  if(body.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
  else if(body.method==='getFeeForMessage')result={context:{slot:1},value:5000};
  else if(body.method==='getAccountInfo'){
   const mint=body.params[0]===USDC_MINT;const data=Buffer.alloc(mint?82:165);
   if(mint){data[44]=6;data[45]=1;}else{new PublicKey(USDC_MINT).toBuffer().copy(data);creator.toBuffer().copy(data,32);data[108]=1;}
   result={context:{slot:1},value:{data:[data.toString('base64'),'base64'],owner:TOKEN_PROGRAM,executable:false,lamports:1,rentEpoch:0}};
  }else throw new Error('Unexpected RPC method');
  return Response.json({jsonrpc:'2.0',id:body.id,result});
 };
 try {
  const remote=mainnetReader();await remote.assertMainnet();
  assert.equal(await remote.feeForMessage(VersionedTransaction.deserialize(Buffer.from(options.serializedTransaction,'base64')).message.serialize()),5000n);
  assert.equal((await remote.tokenAccount(source.toBase58())).owner,creator.toBase58());
 } finally {globalThis.fetch=original;}
 assert.ok(calls.every(method=>['getGenesisHash','getAccountInfo','getFeeForMessage'].includes(method)));
});
