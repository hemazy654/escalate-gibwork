import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { run } from '../core/process.js';
import { redact } from '../core/redact.js';
import { checkBaseline, exportBaseline } from '../core/repository.js';
export function validateOptions(baseline:string, image:string, command:string[]) {
  checkBaseline(baseline);
  if (!/^(?:[a-zA-Z0-9./:_-]+@)?sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Use a trusted, preloaded Docker image pinned by registry digest or full local sha256 image ID');
  if (!command.length || command.some(x=>x.length>4000 || x.includes('\0'))) throw new Error('Provide a test command as a JSON array of arguments');
}
export async function validate(root:string, baseline:string, patchPath:string, image:string, command:string[], dockerRun:typeof run = run) {
  validateOptions(baseline,image,command);
  const dir = await mkdtemp(join(tmpdir(),'escalate-')); const name = `escalate-${randomUUID()}`;
  try {
    await exportBaseline(root, baseline, join(dir, 'repo'));
    if ((await stat(patchPath)).size > 1000000) throw new Error('Patch exceeds 1 MB limit');
    const patch = await readFile(patchPath); if (patch.length>1000000) throw new Error('Patch exceeds 1 MB limit');
    await writeFile(join(dir,'submission.patch'),patch);
    const script = `const fs=require('fs'),cp=require('child_process');fs.cpSync('/input/repo','/work/repo',{recursive:true});process.chdir('/work/repo');let p=cp.spawnSync('git',['apply','--check','/input/submission.patch'],{encoding:'utf8'});if(p.status!==0){console.error(p.stderr);process.exit(2)}p=cp.spawnSync('git',['apply','/input/submission.patch'],{encoding:'utf8'});if(p.status!==0)process.exit(2);const a=JSON.parse(process.argv[1]);p=cp.spawnSync(a[0],a.slice(1),{stdio:'inherit',shell:false,timeout:90000,env:{PATH:process.env.PATH,HOME:'/work',CI:'true'}});process.exit(p.status===0?0:1)`;
    const result = await dockerRun('docker',['run','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=512m','--cpus=1',`--user=${process.getuid?.() || 65534}:${process.getgid?.() || 65534}`,'--tmpfs=/work:rw,nosuid,nodev,size=128m,mode=1777','--tmpfs=/tmp:rw,nosuid,nodev,size=32m','--mount',`type=bind,src=${dir},dst=/input,readonly`,image,'node','-e',script,JSON.stringify(command)],root,120000);
    return {runner:'docker' as const,isolation:'docker' as const,image,command,patchDigest:createHash('sha256').update(patch).digest('hex'),verdict:result.code===0?'PASS' as const:'FAIL' as const,baseline,exitCode:result.code,output:redact(result.output),advisory:true};
  } finally { await dockerRun('docker',['rm','-f',name],root).catch(()=>undefined); await rm(dir,{recursive:true,force:true}); }
}
