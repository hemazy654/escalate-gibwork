import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { WalletSigner } from '@gibwork/sdk';
import { verifyReadOnly, type ReadEvidence } from '../gibwork/live-readonly.js';
import { startPhantomBridge } from './bridge.js';
import { livePage, liveBrowserScript } from './page.js';

async function main() {
  let read: Promise<ReadEvidence> | undefined;
  const bridge=await startPhantomBridge(livePage,liveBrowserScript,300000,async publicKey=>{
    let reveal!: (message:string)=>void;
    const challenge=new Promise<string>(resolve=>{reveal=resolve;});
    read=verifyReadOnly({mode:'live-readonly',signer:{
      publicKey:{toBase58:()=>publicKey} as WalletSigner['publicKey'],
      signMessage:async bytes=>{
        reveal(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
        const signed=await bridge.result;
        if(!signed || signed.publicKey!==publicKey)throw new Error('Signing cancelled');
        return signed.signature;
      }
    }});
    // A setup failure must not leave the browser waiting for a challenge.
    void read.then(()=>reveal('Authentication unavailable. Do not sign.'));
    return challenge;
  });
  const cancel=()=>bridge.stop();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  console.log('ONE LIVE READ ONLY: tasks.listAvailable({ page: 1, limit: 1 })');
  console.log('Open in Brave, connect Phantom, review the exact SDK message, then manually approve message signing:');
  console.log(bridge.url);
  console.log('No retries, transactions or monetary operations. Session expires in five minutes.');
  try {
    const signed=await bridge.result;
    const evidence=read ? await read : null;
    signed?.signature.fill(0);
    if(evidence){
      await mkdir(resolve('.escalate'),{recursive:true,mode:0o700});
      await writeFile(resolve('.escalate/live-readonly-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
      console.log(JSON.stringify(evidence,null,2));
      if(evidence.result!=='success')process.exitCode=1;
    } else {console.log('Cancelled or expired before authentication. Live requests: 0.');process.exitCode=1;}
  } finally {bridge.stop();process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
}
main().catch(()=>{console.error('Read-only verification failed. No authorization material is logged. No retry.');process.exitCode=1;});
