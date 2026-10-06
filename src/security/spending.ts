import { createHash } from 'node:crypto';
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import type { PaymentQuote } from '@gibwork/sdk';

export const USDC_MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const CAP=Object.freeze({usdc:1500000n,sol:10000000n});
export function usdcUnits(value:string):bigint {
  if(!/^\d{1,12}(\.\d{1,6})?$/.test(value))throw new Error('Invalid USDC decimal');
  const [whole,fraction='']=value.split('.');return BigInt(whole!)*1000000n+BigInt(fraction.padEnd(6,'0'));
}
export interface TokenAccount {program:string;mint:string;owner:string;state:'initialized';delegate:null;closeAuthority:null}
/** Must be backed by a trusted independently configured RPC, never by prepare-response data. */
export interface IndependentReader {
  assertMainnet():Promise<void>;
  feeForMessage(message:Uint8Array):Promise<bigint|null>;
  tokenAccount(address:string):Promise<TokenAccount>;
}
export interface Effects {
  transactionSha256:string; quote:PaymentQuote;
  instructions:Array<{program:string;accounts:string[];dataHex:string}>;
  transfers:Array<{asset:'USDC'|'SOL';source:string;recipient:string;amountBaseUnits:string}>;
  verified:boolean;signingAllowed:false;reasons:string[];
  maximumDebit:{usdcBaseUnits:string;solLamports:string}|null;
}
/** Pure review gate; no signer, SDK client, network fallback, transaction submission or approval token. */
export async function inspectPrepared(options:{serializedTransaction:string;quote:PaymentQuote;creator:string;
  approvedRecipients:readonly string[];previousDebits:{usdc:bigint;sol:bigint};reader?:IndependentReader}):Promise<Effects> {
  const report:Effects={transactionSha256:'',quote:options.quote,instructions:[],transfers:[],verified:false,signingAllowed:false,reasons:[],maximumDebit:null};
  try {
    const {quote,creator,previousDebits}=options;
    new PublicKey(creator);
    if(previousDebits.usdc<0n || previousDebits.sol<0n || previousDebits.usdc>CAP.usdc || previousDebits.sol>CAP.sol)throw new Error('Invalid or exhausted cumulative budget');
    if(quote.token.mintAddress!==USDC_MINT || quote.token.symbol!=='USDC' || quote.token.decimals!==6)throw new Error('Quote token mismatch');
    const total=usdcUnits(quote.totalDebit),funding=usdcUnits(quote.fundingAmount),platformFee=usdcUnits(quote.platformFee.amount);
    if(funding!==1000000n || total!==funding+platformFee || !Number.isFinite(quote.platformFee.percent) || quote.platformFee.percent<0 || quote.platformFee.percent>100)throw new Error('Quote amount mismatch');
    if(previousDebits.usdc+total>CAP.usdc)throw new Error('USDC spending cap exceeded');
    const encoded=options.serializedTransaction;
    if(encoded.length>1644 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw new Error('Invalid transaction encoding');
    const bytes=Buffer.from(encoded,'base64');if(bytes.length>1232 || bytes.length===0)throw new Error('Invalid transaction size');
    report.transactionSha256=createHash('sha256').update(bytes).digest('hex');
    const tx=VersionedTransaction.deserialize(bytes);
    if(!Buffer.from(tx.serialize()).equals(bytes))throw new Error('Noncanonical transaction');
    if(tx.version!=='legacy' && tx.version!==0)throw new Error('Unsupported transaction version');
    if(tx.version===0 && tx.message.addressTableLookups.length!==0)throw new Error('Address lookup tables are not independently resolved; blocked');
    if(tx.message.header.numRequiredSignatures!==1 || tx.message.staticAccountKeys[0]?.toBase58()!==creator)throw new Error('Unexpected signers or fee payer');
    if(tx.signatures.some(s=>s.some(byte=>byte!==0)))throw new Error('Only unsigned transactions may be reviewed');
    const message=TransactionMessage.decompile(tx.message);
    report.instructions=message.instructions.map(ix=>({program:ix.programId.toBase58(),accounts:ix.keys.map(k=>k.pubkey.toBase58()),dataHex:ix.data.toString('hex')}));
    if(message.instructions.length===0)throw new Error('Empty transaction');
    if(!options.reader)throw new Error('Independent RPC verification unavailable');
    const reader=options.reader;await reader.assertMainnet();
    const fee=await reader.feeForMessage(tx.message.serialize());
    if(fee===null || fee<0n)throw new Error('Network fee unavailable or blockhash expired');
    let usdc=0n,sol=fee;
    const writable=new Set<string>([creator]);
    for(const ix of message.instructions){
      const program=ix.programId.toBase58(),data=ix.data,keys=ix.keys;
      if(program===TOKEN_PROGRAM){
        // Legacy SPL TransferChecked only. No Token-2022 hooks, delegates, approvals, closes, minting or CPI.
        if(data.length!==10 || data[0]!==12 || data[9]!==6 || keys.length!==4)throw new Error('Unsupported token instruction');
        const source=keys[0]!,mint=keys[1]!,destination=keys[2]!,authority=keys[3]!;
        if(!source.isWritable || source.isSigner || mint.isWritable || mint.isSigner || !destination.isWritable || destination.isSigner || !authority.isSigner || authority.pubkey.toBase58()!==creator || mint.pubkey.toBase58()!==USDC_MINT)throw new Error('Invalid token transfer accounts');
        const recipient=destination.pubkey.toBase58();
        if(!options.approvedRecipients.includes(recipient) || source.pubkey.equals(destination.pubkey))throw new Error('Recipient not independently approved');
        const from=await reader.tokenAccount(source.pubkey.toBase58()),to=await reader.tokenAccount(recipient);
        for(const account of [from,to])if(account.program!==TOKEN_PROGRAM || account.mint!==USDC_MINT || account.state!=='initialized' || account.delegate!==null || account.closeAuthority!==null)throw new Error('Unsupported token account state');
        if(from.owner!==creator)throw new Error('Source token account is not owned by creator');
        const amount=data.readBigUInt64LE(1);usdc+=amount;
        writable.add(source.pubkey.toBase58());writable.add(recipient);
        report.transfers.push({asset:'USDC',source:source.pubkey.toBase58(),recipient,amountBaseUnits:amount.toString()});
      } else if(ix.programId.equals(SystemProgram.programId)){
        if(data.length!==12 || data.readUInt32LE(0)!==2 || keys.length!==2)throw new Error('Unsupported System instruction or rent effect');
        const source=keys[0]!,destination=keys[1]!,recipient=destination.pubkey.toBase58();
        if(!source.isSigner || !source.isWritable || source.pubkey.toBase58()!==creator || !destination.isWritable || destination.isSigner || recipient===creator || !options.approvedRecipients.includes(recipient))throw new Error('Unexpected SOL recipient or authority');
        const amount=data.readBigUInt64LE(4);sol+=amount;writable.add(recipient);
        report.transfers.push({asset:'SOL',source:creator,recipient,amountBaseUnits:amount.toString()});
      } else {throw new Error('Unverified program effects; custom escrow/CPI, compute-budget and account creation are blocked');}
    }
    for(let index=0;index<tx.message.staticAccountKeys.length;index++)if(tx.message.isAccountWritable(index) && !writable.has(tx.message.staticAccountKeys[index]!.toBase58()))throw new Error('Unexpected writable account');
    if(usdc!==total)throw new Error('Decoded token debit does not match quote');
    if(previousDebits.usdc+usdc>CAP.usdc || previousDebits.sol+sol>CAP.sol)throw new Error('Cumulative creator spending cap exceeded');
    report.maximumDebit={usdcBaseUnits:usdc.toString(),solLamports:sol.toString()};report.verified=true;
  }catch(error){report.reasons.push(error instanceof Error?error.message:'Prepared transaction verification failed');}
  return report;
}
