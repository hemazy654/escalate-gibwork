import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startPhantomBridge } from './bridge.js';
import { page, browserScript } from './page.js';
async function main() {
  const bridge=await startPhantomBridge(page,browserScript);
  const cancel=()=>bridge.stop();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  console.log('Open this temporary URL in Brave (expires in five minutes):');
  console.log(bridge.url);
  console.log('Click Connect Phantom, approve connection, then Sign verification message and approve that message only.');
  try {
    const signed=await bridge.result;
    const evidence={provider:'Phantom injected Solana provider',action:'signMessage',timestamp:new Date().toISOString(),result:signed?'signature-verified':'cancelled-or-expired',ed25519Verified:!!signed,signatureLength:signed?.signature.length ?? 0,liveGibworkRequests:0,transactionSigningEnabled:false};
    // The actual public key and signature exist only in memory and are never written to disk.
    signed?.signature.fill(0);
    await mkdir(resolve('.escalate'),{recursive:true,mode:0o700});
    await writeFile(resolve('.escalate/phantom-signing-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(evidence,null,2));if(!signed)process.exitCode=1;
  } finally {bridge.stop();process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
}
main().catch(()=>{console.error('Phantom signing check failed. No wallet material is logged.');process.exitCode=1;});
