import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WalletSigner } from '@gibwork/sdk';
import { verifyReadOnly, type ReadSigner } from '../src/gibwork/live-readonly.js';
// Deliberately invalid mock signature, only usable with an injected in-memory transport.
const fake:ReadSigner={publicKey:{toBase58:()=> 'TEST_PUBLIC_ADDRESS'} as WalletSigner['publicKey'],signMessage:async()=>new Uint8Array(64)};
test('offline default and missing signer never sign or call the network',async()=>{
 let calls=0;const network:typeof fetch=async()=>{calls++;throw new Error('must not connect');};
 assert.equal((await verifyReadOnly({signer:fake},network)).result,'offline');
 const pending=await verifyReadOnly({mode:'live-readonly'},network);
 assert.equal(pending.result,'configuration-required');assert.equal(pending.messageSignatureRequested,false);assert.equal(pending.httpStatus,null);assert.equal(calls,0);
});
test('SDK constructs one production read, requires only message signing, records no authorization',async()=>{
 let calls=0;let signs=0;
 const result=await verifyReadOnly({mode:'live-readonly',signer:{...fake,signMessage:async message=>{signs++;assert.ok(new TextDecoder().decode(message).startsWith('gibwork:view-available-tasks\nmethod:GET'));return new Uint8Array(64);}}},async(input,init)=>{
  calls++;assert.equal(String(input),'https://sdk.gib.work/v2/int/tasks/available?page=1&limit=1');assert.equal(init?.method,'GET');assert.equal(init.redirect,'error');
  assert.equal(new Headers(init.headers).get('x-gibwork-environment'),'prod');
  assert.ok(new Headers(init.headers).has('x-gibwork-signature'));
  return Response.json({results:[],page:1,limit:1,total:0,lastPage:0});
 });
 assert.equal(result.result,'success');assert.equal(result.httpStatus,200);assert.equal(signs,1);assert.equal(calls,1);
 assert.equal(result.transactionSigningEnabled,false);assert.ok(!JSON.stringify(result).includes('TEST_PUBLIC_ADDRESS'));
});
test('failed auth, malformed responses and signer refusal produce sanitized evidence',async()=>{
 const denied=await verifyReadOnly({mode:'live-readonly',signer:fake},async()=>Response.json({authorization:'do-not-log'}, {status:401}));
 assert.equal(denied.authenticationSucceeded,false);assert.equal(denied.result,'failed');assert.ok(!JSON.stringify(denied).includes('do-not-log'));
 const malformed=await verifyReadOnly({mode:'live-readonly',signer:fake},async()=>Response.json({secret:'do-not-log'}));assert.equal(malformed.result,'failed');assert.equal(malformed.authenticationSucceeded,null);
 let calls=0;const refused=await verifyReadOnly({mode:'live-readonly',signer:{...fake,signMessage:async()=>{throw new Error('private-secret-do-not-log');}}},async()=>{calls++;throw new Error();});
 assert.equal(calls,0);assert.equal(refused.result,'failed');assert.ok(!JSON.stringify(refused).includes('private-secret'));
});
