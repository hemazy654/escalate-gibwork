import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detect, reportSchema } from '../src/core/failure.js';
import { redact } from '../src/core/redact.js';
import { brief } from '../src/core/brief.js';
import { scan } from '../src/core/context.js';
import { run } from '../src/core/process.js';
import { fixtureSchema, mockGateway, taskInput } from '../src/gibwork/gateway.js';
import { validateOptions } from '../src/validation/sandbox.js';
const attempt={summary:'Tried a fix',outcome:'fail' as const,output:'Tests failed'};
const report=reportSchema.parse({task:'Fix engine',files:['engine.ts'],attempts:[attempt,attempt,attempt]});
test('consecutive failures trigger escalation and success resets it',()=>{
 assert.equal(detect(report).escalate,true);
 assert.equal(detect({...report,attempts:[...report.attempts,{...attempt,outcome:'pass'},attempt]}).consecutive,1);
 assert.throws(()=>detect(report,NaN)); assert.throws(()=>detect(report,1));
});
test('input rejects unknown fields and oversized output',()=>{
 assert.throws(()=>reportSchema.parse({...report,key:'bad'}));
 assert.throws(()=>reportSchema.parse({...report,attempts:[{...attempt,output:'x'.repeat(32001)}]}));
});
test('redacts key formats, assignments and authenticated URLs',()=>{
 for(const secret of ['ghp_'+'a'.repeat(30),'AKIA'+'A'.repeat(16),'sk-'+'b'.repeat(30)]) assert.ok(!redact(secret).includes(secret));
 assert.equal(redact('API_KEY=superprivate'),'API_KEY=[REDACTED]');
 assert.ok(!redact('Authorization: Bearer superprivate').includes('superprivate'));
 assert.ok(!redact('password="superprivate with spaces"').includes('superprivate'));
 assert.ok(!redact('api_key: "superprivate"').includes('superprivate'));
 assert.ok(!redact('https://user:superprivate@example.com').includes('superprivate'));
 assert.ok(!redact('-----BEGIN PRIVATE KEY-----\nsuperprivate\n-----END PRIVATE KEY-----').includes('superprivate'));
});
test('brief redacts structured fields without corrupting JSON and hashes deterministically',()=>{
 const unsafe={...report,attempts:[{...attempt,output:'TOKEN=superprivate'}]};
 const a=brief(unsafe,{baseline:'a'.repeat(40),files:[]});
 assert.equal(a.digest,brief(unsafe,{baseline:'a'.repeat(40),files:[]}).digest);
 assert.ok(!JSON.stringify(a).includes('superprivate'));
 assert.notEqual(a.digest,brief(report,{baseline:'a'.repeat(40),files:[]}).digest);
});
test('scanner excludes env files, symlinks, untracked data and binary content',async()=>{
 const root=await mkdtemp(join(tmpdir(),'escalate-test-'));
 try {
  await run('git',['init'],root); await run('git',['config','user.name','Test'],root); await run('git',['config','user.email','test@example.invalid'],root);
  await writeFile(join(root,'engine.ts'),'API_KEY=superprivate\nexport const engine=1');
  await writeFile(join(root,'.env'),'TOKEN=hidden'); await writeFile(join(root,'engine.bin'),Buffer.from([0,1,2]));
  await symlink('/etc/passwd',join(root,'engine-link')); await run('git',['add','.'],root); {const c=await run('git',['-c','commit.gpgsign=false','commit','-m','baseline'],root);assert.equal(c.code,0,c.output);}
  await writeFile(join(root,'engine-untracked.ts'),'do not include');
  const result=await scan(root,{...report,files:['engine.ts','.env','engine.bin','engine-link','../etc/passwd']});
  assert.deepEqual(result.files.map(f=>f.path),['engine.ts']); assert.ok(!result.files[0]?.content.includes('superprivate'));
 } finally {await rm(root,{recursive:true,force:true});}
});
test('SDK-backed mock reads only matching task submissions and redacts content',async()=>{
 const data=fixtureSchema.parse([{id:'s1',taskId:'t1',status:'OPEN',content:'TOKEN=superprivate'},{id:'s2',taskId:'t2',status:'OPEN',content:'Other'}]);
 const gateway=mockGateway(data); const result=await gateway.submissions('t1');
 assert.equal(result.length,1); assert.equal(result[0]?.id,'s1'); assert.ok(!result[0]?.content.includes('superprivate'));
 await assert.rejects(gateway.create(taskInput('Title','Body','5','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')),/disabled/);
});
test('SDK task payload escapes HTML and rejects invalid reward or mint',()=>{
 const mint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
 assert.equal(taskInput('Fix','<script>','2.50',mint).content,'<pre>&lt;script&gt;</pre>');
 for(const amount of ['0','-1','NaN','1e4','1.0000001'])assert.throws(()=>taskInput('Fix','Body',amount,mint));
 assert.throws(()=>taskInput('Fix','Body','1','bad'));
});
test('sandbox refuses mutable images, missing baseline and empty command',()=>{
 const sha='a'.repeat(40),image='node@sha256:'+'b'.repeat(64);
 validateOptions(sha,image,['node','--test']);
 validateOptions(sha,'sha256:'+'c'.repeat(64),['node','--test']);
 assert.throws(()=>validateOptions(sha,'node:22',['node']));
 assert.throws(()=>validateOptions('HEAD',image,['node']));
 assert.throws(()=>validateOptions(sha,image,[]));
});
test('process runner bounds output and terminates timeout',async()=>{
 assert.equal((await run(process.execPath,['-e','setInterval(()=>{},1000)'],process.cwd(),40)).code,124);
 assert.equal((await run(process.execPath,['-e','console.log("x".repeat(10000))'],process.cwd(),1000,100)).code,124);
});
test('validation pins baseline, confines Docker and fails closed on test failure',async()=>{
 const {validate}=await import('../src/validation/sandbox.js');
 const root=await mkdtemp(join(tmpdir(),'escalate-validation-'));
 try {
  await run('git',['init'],root);await run('git',['config','user.name','Test'],root);await run('git',['config','user.email','test@example.invalid'],root);
  await writeFile(join(root,'engine.ts'),'export const engine=1;\n');await run('git',['add','.'],root);{const c=await run('git',['-c','commit.gpgsign=false','commit','-m','baseline'],root);assert.equal(c.code,0,c.output);}
  const baseline=(await run('git',['rev-parse','HEAD'],root)).stdout.trim();
  assert.match(baseline,/^[a-f0-9]{40}$/,baseline);const patch=join(root,'change.patch');await writeFile(patch,'local patch fixture');
  for(const code of [0,1,124]) {
   const calls:string[][]=[];
   const fake:typeof run=async(_cmd,args)=>{calls.push(args);return {code,output:'TOKEN=do-not-leak',stdout:'',stderr:''};};
   const result=await validate(root,baseline,patch,'trusted@sha256:'+'b'.repeat(64),['node','--test'],fake);
   assert.equal(result.verdict,code===0?'PASS':'FAIL');assert.ok(!result.output.includes('do-not-leak'));
   assert.equal(result.patchDigest.length,64);assert.ok(calls[0]?.includes('--network=none'));assert.ok(calls[0]?.includes('--read-only'));assert.ok(calls[0]?.includes('--cap-drop=ALL'));assert.ok(calls[0]?.includes('--pull=never'));assert.equal(calls[1]?.[0],'rm');
  }
 } finally {await rm(root,{recursive:true,force:true});}
});
test('serialized redacted bounty preserves source and attempt structure exactly', () => {
 const context={baseline:'a'.repeat(40),files:[{path:'engine.ts',content:redact('API_KEY=synthetic\nexport const engine=1;')}]};
 const draft=brief({...report,attempts:[{...attempt,output:'TOKEN=synthetic\nError: assertion failed'}]},context);
 const payload=taskInput(draft.task,JSON.stringify(draft), '5', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
 const decoded=payload.content.slice(5,-6).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 assert.deepEqual(JSON.parse(decoded),draft);
 assert.ok(!decoded.includes('synthetic'));
});
test('context reads committed content despite modified or replaced worktree paths', async () => {
 const root=await mkdtemp(join(tmpdir(),'escalate-snapshot-'));
 try {
  await run('git',['init'],root); await run('git',['config','user.name','Test'],root); await run('git',['config','user.email','test@example.invalid'],root);
  await mkdir(join(root,'src')); await writeFile(join(root,'src/engine.ts'),'export const engine=1;');
  await run('git',['add','.'],root);const committed=await run('git',['-c','commit.gpgsign=false','commit','-m','baseline'],root);assert.equal(committed.code,0,committed.output);
  await rm(join(root,'src'),{recursive:true});await symlink('/etc',join(root,'src'));
  const context=await scan(root,{...report,files:['src/engine.ts']});
  assert.equal(context.files[0]?.content,'export const engine=1;');
  await assert.rejects(scan(join(root,'src'),report));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('process output preserves UTF-8 across split byte chunks', async () => {
 const result=await run(process.execPath,['-e', "const b=Buffer.from('€');process.stdout.write(b.subarray(0,1));setTimeout(()=>process.stdout.write(b.subarray(1)),30)"],process.cwd());
 assert.equal(result.stdout,'€');
});
