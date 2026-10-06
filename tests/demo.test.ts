import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { run } from '../src/core/process.js';
import { runTrustedDemo } from '../src/demo/runner.js';

test('full offline story proves FAIL to PASS and deterministic identities on repeat runs', async () => {
 const results: Record<string,unknown>[]=[];
 for(let i=0;i<2;i++) {
  const result=await run(process.execPath,[resolve('dist/demo/main.js'),'--json'],process.cwd(),60000);
  assert.equal(result.code,0,result.output);
  const story=JSON.parse(result.stdout);
  assert.equal(story.runner,'trusted-local-demo');assert.equal(story.isolation,'none');assert.equal(story.financialOperationsEnabled,false);
  assert.equal(story.before.verdict,'FAIL');assert.equal(story.after.verdict,'PASS');
  assert.equal(story.after.patchDigest,story.patchDigest);
  assert.match(story.after.output,/# pass 2/);assert.match(story.after.output,/# fail 0/);
  assert.ok(!result.stdout.includes('DEMO_ONLY_NOT_A_REAL_CREDENTIAL'));
  results.push(story);
 }
 for(const key of ['baseline','contextDigest','patchDigest','taskId','submissionId']) assert.equal(results[0]?.[key],results[1]?.[key],key);
});
test('demo runner cannot execute an external candidate patch',async()=>{
 await assert.rejects(runTrustedDemo('.', 'a'.repeat(40), 'arbitrary patch'),/exact bundled patch/);
});
test('demo runner rejects a baseline that differs from the bundled trusted fixture',async()=>{
 const root=await mkdtemp(join(tmpdir(),'escalate-demo-untrusted-'));
 try {
  await run('git',['init'],root); await run('git',['config','user.name','Test'],root);await run('git',['config','user.email','test@example.invalid'],root);
  const {writeFile}=await import('node:fs/promises');await writeFile(join(root,'unexpected.ts'),'throw new Error("must never run")');
  await run('git',['add','.'],root);const c=await run('git',['-c','commit.gpgsign=false','commit','-m','untrusted'],root);assert.equal(c.code,0,c.output);
  const head=await run('git',['rev-parse','HEAD'],root);
  await assert.rejects(runTrustedDemo(root,head.stdout.trim(),undefined),/differs from trusted fixture/);
 }finally{await rm(root,{recursive:true,force:true});}
});
