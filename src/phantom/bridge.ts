import { createPublicKey, randomBytes, verify, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { z } from 'zod';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function publicKeyBytes(address: string): Buffer {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new Error('Invalid public key');
  let integer = 0n;
  for (const char of address) integer = integer * 58n + BigInt(alphabet.indexOf(char));
  const bytes: number[] = [];
  while (integer > 0n) { bytes.unshift(Number(integer & 255n)); integer >>= 8n; }
  for (const char of address) { if (char !== '1') break; bytes.unshift(0); }
  if (bytes.length !== 32) throw new Error('Public key must be 32 bytes');
  return Buffer.from(bytes);
}
export function validSignature(message: Uint8Array, publicKey: string, signature: Uint8Array): boolean {
  try {
    if (signature.length !== 64) return false;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), publicKeyBytes(publicKey)]), format: 'der', type: 'spki' });
    return verify(null, message, key, signature);
  } catch { return false; }
}
const signatureSchema = z.object({publicKey:z.string().max(44),signature:z.array(z.number().int().min(0).max(255)).length(64)}).strict();
export type PublicSignature = { publicKey: string; signature: Uint8Array };

// This helper has no Gibwork client, network fetch, wallet import or transaction API.
export async function startPhantomBridge(page: string, browserScript: string, lifetimeMs = 300000, challenge?: (publicKey: string) => Promise<string>) {
  if (!Number.isInteger(lifetimeMs) || lifetimeMs < 100 || lifetimeMs > 300000) throw new Error('Invalid bridge lifetime');
  const token = randomBytes(32).toString('hex'); // ephemeral local session capability, NOT a wallet key
  let origin = ''; let message = ''; let complete = false; let challengeStarted = false; let connectedKey: string | undefined;
  let resolveResult!: (value: PublicSignature | null) => void;
  const result = new Promise<PublicSignature | null>(resolve => { resolveResult = resolve; });
  let timer:ReturnType<typeof setTimeout> | undefined;
  const server = createServer((request,response) => { void handle(request,response).catch(()=>{if(!response.headersSent)send(response,400,{error:'Invalid signing response'});else response.destroy();}); });
  function send(response:ServerResponse,status:number,data:unknown) {
    response.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});response.end(JSON.stringify(data));
  }
  function stop() { if(timer)clearTimeout(timer); server.close(); server.closeAllConnections(); if(!complete){complete=true;resolveResult(null);} }
  function authorized(request:IncomingMessage) {
    const supplied=request.headers['x-escalate-session'];
    return typeof supplied==='string' && supplied.length===token.length && timingSafeEqual(Buffer.from(supplied),Buffer.from(token));
  }
  async function handle(request:IncomingMessage,response:ServerResponse) {
    if(request.headers.host!==new URL(origin).host){send(response,403,{error:'Invalid host'});return;}
    if(complete){send(response,410,{error:'Session ended'});return;}
    if(request.method==='GET' && (request.url==='/' || request.url==='/bridge.js')) {
      response.writeHead(200,{'content-type':request.url==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});
      response.end(request.url==='/'?page:browserScript);return;
    }
    if(!authorized(request)){send(response,403,{error:'Invalid session'});return;}
    if(request.method==='GET' && request.url?.startsWith('/challenge')) {
      if(challenge) {
        if(challengeStarted){send(response,409,{error:'Authentication cannot be retried'});return;}
        const key=new URL(request.url,origin).searchParams.get('publicKey');
        if(!key){send(response,400,{error:'Public key required'});return;}
        publicKeyBytes(key);challengeStarted=true;connectedKey=key;
        message=await challenge(key);
      } else if(request.url!=='/challenge'){send(response,405,{error:'Unsupported request'});return;}
      send(response,200,{message});return;
    }
    if(request.method==='POST' && request.url==='/signature') {
      if(request.headers.origin!==origin || request.headers['content-type']!=='application/json'){send(response,403,{error:'Invalid origin or content type'});return;}
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of request){size+=chunk.length;if(size>2048){send(response,413,{error:'Response too large'});return;}chunks.push(Buffer.from(chunk));}
      const parsed=signatureSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const signature=Uint8Array.from(parsed.signature);
      if((connectedKey!==undefined && parsed.publicKey!==connectedKey) || !validSignature(new TextEncoder().encode(message),parsed.publicKey,signature)){send(response,400,{error:'Signature does not match this challenge'});return;}
      if(complete){send(response,410,{error:'Session ended'});return;}
      complete=true;if(timer)clearTimeout(timer);
      // Only public key/signature cross this boundary; never persist or log them.
      send(response,200,{verified:true});server.close(()=>resolveResult({publicKey:parsed.publicKey,signature}));return;
    }
    send(response,405,{error:'Unsupported request'});
  }
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=8;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
  const address=server.address();if(!address || typeof address==='string'){stop();throw new Error('Cannot bind local bridge');}
  origin=`http://127.0.0.1:${address.port}`;
  message=`ESCALATE signing-path verification only\nNo Gibwork request or transaction will be sent.\nNo funds, approvals, payouts or refunds are authorized.\norigin:${origin}\nnonce:${randomBytes(32).toString('hex')}\nexpires:${new Date(Date.now()+lifetimeMs).toISOString()}`;
  timer=setTimeout(stop,lifetimeMs);
  return { url:`${origin}/#${token}`, origin, result, stop };
}
