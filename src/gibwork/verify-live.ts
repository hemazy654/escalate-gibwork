import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyReadOnly } from './live-readonly.js';

async function main() {
  const mode=process.env.ESCALATE_VERIFY_MODE;
  if(mode!==undefined && mode!=='mock' && mode!=='live-readonly')throw new Error('ESCALATE_VERIFY_MODE must be mock or live-readonly');
  // No external signer has been provisioned. Never load raw key environment variables/files.
  const evidence=await verifyReadOnly(mode===undefined?{}:{mode});
  await mkdir(resolve('.escalate'),{recursive:true,mode:0o700});
  await writeFile(resolve('.escalate/live-readonly-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(evidence,null,2));
  if(evidence.result==='configuration-required'||evidence.result==='failed')process.exitCode=1;
}
main().catch(()=>{console.error('Read-only verification setup failed. No authorization material is logged.');process.exitCode=1;});
