import { Connection, PublicKey } from '@solana/web3.js';
import {TOKEN_PROGRAM,USDC_MINT,type IndependentReader} from './spending.js';

const MAINNET_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
/** Explicitly constructed only: no RPC calls on import. Never accepts an endpoint from a prepared intent. */
export function mainnetReader():IndependentReader {
  const allowed=new Set(['getGenesisHash','getFeeForMessage','getAccountInfo']);
  const rpcFetch:typeof fetch=async(input,init)=>{
    if(new URL(String(input)).href!=='https://api.mainnet-beta.solana.com/' || init?.method!=='POST' || typeof init.body!=='string')throw new Error('RPC operation blocked');
    const body=JSON.parse(init.body) as {method?:string};
    if(!body.method || !allowed.has(body.method))throw new Error('RPC method blocked');
    return globalThis.fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(10000)});
  };
  const connection=new Connection('https://api.mainnet-beta.solana.com',{commitment:'finalized',fetch:rpcFetch,disableRetryOnRateLimit:true});
  return {
    async assertMainnet(){
      if(await connection.getGenesisHash()!==MAINNET_GENESIS)throw new Error('RPC cluster is not mainnet');
      const mint=await connection.getAccountInfo(new PublicKey(USDC_MINT));
      if(!mint || mint.executable || mint.owner.toBase58()!==TOKEN_PROGRAM || mint.data.length!==82 || mint.data[44]!==6 || mint.data[45]!==1)throw new Error('Independent USDC mint verification failed');
    },
    async feeForMessage(message){
      const {VersionedMessage}=await import('@solana/web3.js');
      const result=await connection.getFeeForMessage(VersionedMessage.deserialize(message),'finalized');
      if(result.value===null)return null;
      if(!Number.isSafeInteger(result.value) || result.value<0)throw new Error('Unsafe RPC fee');
      return BigInt(result.value);
    },
    async tokenAccount(address){
      const account=await connection.getAccountInfo(new PublicKey(address));
      if(!account || account.executable || account.owner.toBase58()!==TOKEN_PROGRAM || account.data.length!==165)throw new Error('Invalid independent token account');
      const data=account.data;
      if(data[108]!==1 || data.readUInt32LE(72)!==0 || data.readUInt32LE(109)!==0 || data.readUInt32LE(129)!==0 || data.readBigUInt64LE(121)!==0n)throw new Error('Frozen, delegated, native or closable token account');
      return {program:account.owner.toBase58(),mint:new PublicKey(data.subarray(0,32)).toBase58(),owner:new PublicKey(data.subarray(32,64)).toBase58(),state:'initialized',delegate:null,closeAuthority:null};
    }
  };
}
