import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../src/core/process.js';
const cli=resolve('dist/cli.js');
test('CLI diagnose/create/review offline flow, duplicate protection and useful errors',async()=>{
 const root=await mkdtemp(join(tmpdir(),'escalate-cli-'));
 try {
  await run('git',['init'],root);await run('git',['config','user.name','Test'],root);await run('git',['config','user.email','test@example.invalid'],root);
  await writeFile(join(root,'engine.ts'),'export const engine=1');await run('git',['add','.'],root);{const c=await run('git',['-c','commit.gpgsign=false','commit','-m','baseline'],root);assert.equal(c.code,0,c.output);}
  const report=join(root,'report.json');await writeFile(report,JSON.stringify({task:'Fix engine',files:['engine.ts'],attempts:Array.from({length:3},()=>({summary:'Failed fix',outcome:'fail',output:'TOKEN=sensitive-value'}))}));
  const base=['--report',report,'--repo',root];
  const diagnosis=await run(process.execPath,[cli,'diagnose',...base],root);
  assert.equal(diagnosis.code,0,diagnosis.output);assert.equal(JSON.parse(diagnosis.output).failure.escalate,true);
  const args=[cli,'create',...base,'--amount','5','--mint','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','--out',join(root,'drafts')];
  const created=await run(process.execPath,args,root);assert.equal(created.code,0);
  const object=JSON.parse(created.output.slice(created.output.indexOf('{\n')));const saved=await readFile(object.file,'utf8');
  assert.ok(!saved.includes('sensitive-value'));assert.equal(JSON.parse(saved).financialOperationsEnabled,false);
  assert.notEqual((await run(process.execPath,args,root)).code,0);
  const reviewed=await run(process.execPath,[cli,'review','example-task','--fixtures',resolve('examples/submissions.json')],root);assert.equal(reviewed.code,0);
  const bad=await run(process.execPath,[cli,'diagnose','--report',report,'--repo',root,'--threshold','bad'],root);assert.equal(bad.code,1);assert.match(bad.output,/Threshold/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('review rejects live mode instead of exposing an alternate financial path', async () => {
 const result=await run(process.execPath,[cli,'review','example-task','--fixtures',resolve('examples/submissions.json')],process.cwd(),15000,128000,{ESCALATE_MODE:'live'});
 assert.equal(result.code,1);assert.match(result.stderr,/Only mock mode/);
});
