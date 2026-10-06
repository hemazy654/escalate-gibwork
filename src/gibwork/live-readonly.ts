import { createHash } from 'node:crypto';
import { GibworkClient, DEFAULT_GIBWORK_API_URL, type WalletSigner, type FetchImplementation } from '@gibwork/sdk';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export type ReadSigner = Pick<WalletSigner, 'publicKey' | 'signMessage'>;
const path = '/v2/int/tasks/available';
const query = { page: 1, limit: 1 };
const pageSchema = z.object({results:z.array(z.object({id:z.string(),title:z.string()})).max(1),page:z.literal(1),limit:z.literal(1),total:z.number().int().nonnegative(),lastPage:z.number().int().nonnegative()});
export interface ReadEvidence {
  sdkVersion:string; endpoint:string; action:'tasks.listAvailable'; timestamp:string;
  result:'configuration-required'|'offline'|'success'|'failed'; httpStatus:number|null;
  authenticationSucceeded:boolean|null; messageSignatureRequired:true; messageSignatureRequested:boolean;
  transactionSigningEnabled:false; transactionSigningOccurred:false; liveRequests:number; messageSigningOccurred:boolean; errorCode:string|null;
}
/** No key loading, generation, transaction methods, retries, redirects or arbitrary endpoints. */
export async function verifyReadOnly(options: {mode?:'mock'|'live-readonly';signer?:ReadSigner}, transport:FetchImplementation=globalThis.fetch):Promise<ReadEvidence> {
  const metadata=JSON.parse(await readFile(new URL('../../node_modules/@gibwork/sdk/package.json',import.meta.url),'utf8')) as {version:string};
  // Compiled module is under dist/gibwork, so resolve the package from the project root.
  const endpoint=`${DEFAULT_GIBWORK_API_URL}${path}?page=1&limit=1`;
  const evidence:ReadEvidence={sdkVersion:metadata.version,endpoint,action:'tasks.listAvailable',timestamp:new Date().toISOString(),result:'offline',httpStatus:null,authenticationSucceeded:null,messageSignatureRequired:true,messageSignatureRequested:false,transactionSigningEnabled:false,transactionSigningOccurred:false,liveRequests:0,messageSigningOccurred:false,errorCode:null};
  if(options.mode!=='live-readonly')return evidence;
  if(!options.signer){evidence.result='configuration-required';evidence.errorCode='EXTERNAL_MESSAGE_SIGNER_REQUIRED';return evidence;}
  const external=options.signer;
  const signer:WalletSigner={publicKey:external.publicKey,signTransaction:async()=>{throw new Error('Transaction signing is disabled');},signMessage:async message=>{
    const lines=new TextDecoder().decode(message).split('\n');
    const expectedHash=createHash('sha256').update(JSON.stringify(query)).digest('hex');
    if(lines.length!==7 || lines[0]!=='gibwork:view-available-tasks' || lines[1]!=='method:GET' || lines[2]!==`path:${path}` || lines[3]!==`walletAddress:${external.publicKey.toBase58()}` || lines[6]!==`queryHash:${expectedHash}`)throw new Error('Unexpected wallet authentication challenge');
    evidence.messageSignatureRequested=true;
    const signature=await external.signMessage(message);evidence.messageSigningOccurred=true;return signature;
  }};
  let requests=0;
  const client=new GibworkClient({signer,production:true,timeoutMs:10000,fetch:async(input,init)=>{
    if(String(input)!==endpoint || init?.method!=='GET' || init.body!==undefined || ++requests!==1)throw new Error('Read-only transport rejected request');
    evidence.liveRequests=requests;
    const response=await transport(input,{...init,redirect:'error'});
    evidence.httpStatus=response.status;
    if(response.status===401 || response.status===403)evidence.authenticationSucceeded=false;
    // Bound response parsing; discard all bodies and headers from evidence, including errors.
    const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
    if(reader){try {while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>128000)throw new Error('Response exceeds read verification limit');chunks.push(next.value);}}finally{await reader.cancel();reader.releaseLock();}}
    const bytes=Buffer.concat(chunks);
    return new Response(response.status===204?null:bytes,{status:response.status,headers:{'content-type':'application/json'}});
  }});
  try {
    const page=await client.tasks.listAvailable(query);
    pageSchema.parse(page);
    evidence.result='success';evidence.authenticationSucceeded=true;
  }catch{
    evidence.result='failed';evidence.errorCode=evidence.httpStatus===401 || evidence.httpStatus===403?'AUTHENTICATION_OR_ACCESS_DENIED':'READ_VERIFICATION_FAILED';
  }
  return evidence;
}
