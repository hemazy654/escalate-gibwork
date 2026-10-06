import { test } from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { publicKeyBytes, validSignature, startPhantomBridge } from '../src/phantom/bridge.js';
import { page, browserScript } from '../src/phantom/page.js';
// Public RFC 8032 vector only. No private keys/seeds are needed or present.
const publicHex='d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
const signature=Buffer.from('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b','hex');
function encodePublic(bytes:Buffer) {const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let value=BigInt('0x'+bytes.toString('hex'));let address='';while(value){address=alphabet[Number(value%58n)]+address;value/=58n;}for(const byte of bytes){if(byte!==0)break;address='1'+address;}return address;}
const publicAddress=encodePublic(Buffer.from(publicHex,'hex'));
test('Node verifies Ed25519 public vector and rejects changed messages, keys and signatures',()=>{
 assert.equal(validSignature(new Uint8Array(),publicAddress,signature),true);
 assert.equal(validSignature(new TextEncoder().encode('changed'),publicAddress,signature),false);
 assert.equal(validSignature(new Uint8Array(),publicAddress,signature.subarray(0,63)),false);
 assert.equal(validSignature(new Uint8Array(),'not-a-key',signature),false);
 assert.deepEqual(publicKeyBytes('1'.repeat(32)),Buffer.alloc(32));
 assert.throws(()=>publicKeyBytes('1'.repeat(33)));
});
test('bridge only exposes a bounded local verification challenge with session capability',async()=>{
 const bridge=await startPhantomBridge(page,browserScript);
 try {
  const token=new URL(bridge.url).hash.slice(1);
  const html=await fetch(bridge.origin+'/');assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy')!,/frame-ancestors 'none'/);assert.equal(html.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(bridge.origin+'/challenge')).status,403);
  const challenge=await fetch(bridge.origin+'/challenge',{headers:{'x-escalate-session':token}});const data=await challenge.json();
  assert.match(data.message,/No Gibwork request or transaction will be sent/);
  assert.match(data.message,/origin:http:\/\/127\.0\.0\.1:/);assert.ok(!data.message.includes('gibwork:view-available-tasks'));
  const headers={'content-type':'application/json','x-escalate-session':token,origin:bridge.origin};
  const payload=JSON.stringify({publicKey:publicAddress,signature:Array.from(signature)});
  assert.equal((await fetch(bridge.origin+'/signature',{method:'POST',headers:{...headers,origin:'https://untrusted.example'},body:payload})).status,403);
  // A signature for a different message is not accepted, even though cryptographically valid.
  assert.equal((await fetch(bridge.origin+'/signature',{method:'POST',headers,body:payload})).status,400);
  assert.equal((await fetch(bridge.origin+'/signature',{method:'POST',headers,body:'x'.repeat(2049)})).status,413);
  assert.equal((await fetch(bridge.origin+'/transaction',{method:'POST',headers,body:'{}'})).status,405);
  const rebound=await new Promise<number>(resolve=>{const req=request(bridge.origin+'/challenge',{headers:{'x-escalate-session':token,host:'attacker.example'}},response=>{response.resume();resolve(response.statusCode!);});req.end();});
  assert.equal(rebound,403);
 }finally{bridge.stop();assert.equal(await bridge.result,null);}
});
test('sessions expire and page uses only explicit connect/message-sign actions',async()=>{
 const bridge=await startPhantomBridge(page,browserScript,100);
 assert.equal(await bridge.result,null);
 assert.match(browserScript,/provider\.connect\(\)/);assert.match(browserScript,/provider\.signMessage\(/);
 assert.ok(!/signTransaction|signAndSendTransaction|localStorage|sessionStorage/.test(browserScript));
 assert.throws(()=>publicKeyBytes('0'.repeat(44)));
});
test('browser flow requires connect/sign clicks and forwards only public key/signature',async()=>{
 const {runInNewContext}=await import('node:vm');
 const elements=new Map<string,Record<string,unknown>>();for(const id of ['status','message','connect','sign','disconnect'])elements.set(id,{disabled:id!=='connect'});
 let connections=0,signatures=0;let posted:unknown=null;
 const provider={isPhantom:true,publicKey:{toString:()=>publicAddress},connect:async()=>{connections++;return {publicKey:{toString:()=>publicAddress}};},signMessage:async(bytes:Uint8Array,display:string)=>{signatures++;assert.equal(new TextDecoder().decode(bytes),'Fixed non-authorizing challenge');assert.equal(display,'utf8');return {publicKey:{toString:()=>publicAddress},signature};},disconnect:async()=>{},on:()=>{}};
 runInNewContext(browserScript,{document:{getElementById:(id:string)=>elements.get(id)},location:{hash:'#test-session',pathname:'/'},history:{replaceState:()=>{}},window:{phantom:{solana:provider}},TextEncoder,fetch:async(path:string,options:RequestInit)=>{
  assert.equal((options.headers as Record<string,string>)['x-escalate-session'],'test-session');
  if(path==='/challenge')return {ok:true,json:async()=>({message:'Fixed non-authorizing challenge'})};
  assert.equal(path,'/signature');posted=JSON.parse(options.body as string);return {ok:true,json:async()=>({verified:true})};
 }});
 assert.equal(connections,0);assert.equal(signatures,0);
 await (elements.get('connect')!.onclick as ()=>Promise<void>)();assert.equal(connections,1);assert.equal(signatures,0);
 await (elements.get('sign')!.onclick as ()=>Promise<void>)();assert.equal(signatures,1);
 assert.deepEqual(posted,{publicKey:publicAddress,signature:Array.from(signature)});
 assert.match(elements.get('status')!.textContent as string,/Verified by ESCALATE/);
});

test('live challenge is bound to one public address and cannot be requested again',async()=>{
  const {livePage,liveBrowserScript}=await import('../src/phantom/page.js');
  let challenges=0;
  const bridge=await startPhantomBridge(livePage,liveBrowserScript,1000,async()=>{challenges++;return 'gibwork:view-available-tasks\nmethod:GET';});
  try {
    const url=new URL(bridge.url);const headers={'x-escalate-session':url.hash.slice(1)};
    // All-zero public Ed25519 bytes; no private key or signing involved.
    const path=bridge.origin+'/challenge?publicKey='+ '1'.repeat(32);
    const first=await fetch(path,{headers});assert.equal(first.status,200);
    assert.equal((await first.json()).message,'gibwork:view-available-tasks\nmethod:GET');
    assert.equal((await fetch(path,{headers})).status,409);assert.equal(challenges,1);
    assert.ok(livePage.includes('one GET'));assert.ok(liveBrowserScript.includes('encodeURIComponent(publicKey)'));
  } finally {bridge.stop();}
});
