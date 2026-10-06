import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { validate } from '../src/validation/sandbox.js';
import { run } from '../src/core/process.js';

const compilerTest = ['node','-e',"const c=require('child_process');c.execFileSync('node',['/opt/typescript/bin/tsc','-p','tsconfig.json','--typeRoots','/opt/types'],{stdio:'inherit'});c.execFileSync('node',['--test','build/tests/retry.test.js'],{stdio:'inherit'});"];
test('real Docker: FAIL → PASS, read-only/network/privacy boundaries and cleanup', {timeout:180000}, async()=>{
 const {image,baseImage}=JSON.parse(await readFile(resolve('.escalate/docker-image.json'),'utf8')) as {image:string; baseImage:string};
 const directory=await mkdtemp(join(tmpdir(),'escalate-docker-check-'));const repo=join(directory,'repo');
 const names:string[]=[];const records:unknown[]=[];
 async function docker(args:string[]) {return run('docker',args,process.cwd());}
 const actualDocker:typeof run=async(command,args,cwd,timeout,limit)=>{
  const result=await run(command,args,cwd,timeout,limit);
  if(args[0]==='run') {
   const name=args[args.indexOf('--name')+1]!;names.push(name);
   const inspect=await docker(['inspect',name]);assert.equal(inspect.code,0,inspect.output);
   const [container]=JSON.parse(inspect.stdout);
   assert.equal(container.HostConfig.NetworkMode,'none');assert.equal(container.HostConfig.ReadonlyRootfs,true);
   assert.deepEqual(container.HostConfig.CapDrop,['ALL']);assert.ok(container.HostConfig.SecurityOpt.includes('no-new-privileges'));
   assert.equal(container.HostConfig.Memory,512*1024*1024);assert.equal(container.HostConfig.PidsLimit,128);assert.equal(container.HostConfig.NanoCpus,1000000000);
   assert.ok(!container.Config.User.startsWith('0:'));
   assert.equal(container.Mounts.length,1);assert.equal(container.Mounts[0].Destination,'/input');assert.equal(container.Mounts[0].RW,false);
   records.push({exitCode:container.State.ExitCode,network:container.HostConfig.NetworkMode,readOnlyRoot:container.HostConfig.ReadonlyRootfs,user:container.Config.User,capDrop:container.HostConfig.CapDrop,memory:container.HostConfig.Memory,pids:container.HostConfig.PidsLimit,cpus:container.HostConfig.NanoCpus,inputReadOnly:!container.Mounts[0].RW});
  }
  return result;
 };
 try {
  await cp(resolve('demo/repository'),repo,{recursive:true});
  for(const args of [['init','--template=','--initial-branch=main'],['add','.'],['-c','user.name=ESCALATE Docker Check','-c','user.email=docker@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-m','Pinned retry-policy baseline']]) {
   const result=await run('git',args,repo);assert.equal(result.code,0,result.output);
  }
  const baseline=(await run('git',['rev-parse','HEAD'],repo)).stdout.trim();
  const harmless=join(directory,'no-fix.patch');
  await writeFile(harmless,'diff --git a/validation-note.txt b/validation-note.txt\nnew file mode 100644\n--- /dev/null\n+++ b/validation-note.txt\n@@ -0,0 +1 @@\n+Docker verification only\n');
  const failed=await validate(repo,baseline,harmless,image,compilerTest,actualDocker);
  assert.equal(failed.verdict,'FAIL');assert.match(failed.output,/# fail 1/);
  const passed=await validate(repo,baseline,resolve('demo/solution.patch'),image,compilerTest,actualDocker);
  assert.equal(passed.verdict,'PASS',passed.output);assert.match(passed.output,/# pass 2/);
  const probeScript=`const fs=require('fs'),os=require('os'),assert=require('assert/strict'),net=require('net');assert.ok(process.getuid()>0);assert.equal(fs.existsSync('/var/run/docker.sock'),false);assert.equal(process.env.ESCALATE_HOST_CANARY,undefined);assert.equal(fs.existsSync('/input/repo/.git'),false);assert.throws(()=>fs.writeFileSync('/root-write-probe','x'),e=>e.code==='EROFS'||e.code==='EACCES');assert.throws(()=>fs.writeFileSync('/input/submission.patch','x'),e=>e.code==='EROFS'||e.code==='EACCES');assert.deepEqual(Object.keys(os.networkInterfaces()),['lo']);const socket=net.createConnection({host:'1.1.1.1',port:443});socket.on('connect',()=>{console.error('Unexpected network access');socket.destroy();process.exitCode=1});socket.on('error',e=>{assert.equal(e.code,'ENETUNREACH');console.log('Boundary checks PASS: nonroot, no external network, read-only root/input, no socket, no host canary, no original .git')});socket.setTimeout(2000,()=>{socket.destroy();process.exitCode=1});`;
  process.env.ESCALATE_HOST_CANARY='synthetic-host-value';
  const boundaries=await validate(repo,baseline,harmless,image,['node','-e',probeScript],actualDocker);
  delete process.env.ESCALATE_HOST_CANARY;
  assert.equal(boundaries.verdict,'PASS',boundaries.output);assert.match(boundaries.output,/Boundary checks PASS/);
  const bad=join(directory,'invalid.patch');await writeFile(bad,'not a valid Git patch');
  const invalid=await validate(repo,baseline,bad,image,compilerTest,actualDocker);assert.equal(invalid.verdict,'FAIL');assert.equal(invalid.exitCode,2);
  const reviewed=await run(process.execPath,[resolve('dist/cli.js'),'review','retry-policy-task','--fixtures',resolve('demo/submissions.json'),'--submission','retry-policy-human-fix','--patch',resolve('demo/solution.patch'),'--repo',repo,'--baseline',baseline,'--image',image,'--test-argv',JSON.stringify(compilerTest)],process.cwd(),120000);
  assert.equal(reviewed.code,0,reviewed.output);
  const cliReview=JSON.parse(reviewed.stdout);
  assert.equal(cliReview.verdict,'PASS');assert.equal(cliReview.runner,'docker');assert.equal(cliReview.isolation,'docker');
  assert.equal(cliReview.submissionId,'retry-policy-human-fix');assert.equal(cliReview.patchDigest,passed.patchDigest);
  assert.equal((await run('git',['status','--porcelain'],repo)).stdout,'');
  for(const name of names)assert.notEqual((await docker(['container','inspect',name])).code,0,`Leaked container ${name}`);
  const artifact=resolve('.escalate/docker-validation.json');await mkdir(resolve('.escalate'),{recursive:true,mode:0o700});
  await writeFile(artifact,JSON.stringify({runner:'docker',isolation:'docker',image,baseImage,baseline,financialOperationsEnabled:false,failed,passed,boundaries,invalid,cliReview,observedContainers:records,cleanupVerified:true},null,2)+'\n',{mode:0o600});
  console.log(`Real Docker evidence: ${artifact}`);
 }finally{
  delete process.env.ESCALATE_HOST_CANARY;
  for(const name of names)await docker(['rm','-f',name]);
  await rm(directory,{recursive:true,force:true});
 }
});
