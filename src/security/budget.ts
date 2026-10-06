import {mkdir,open,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CAP,type Effects} from './spending.js';
const amount=z.string().regex(/^\d{1,20}$/);
const records=z.array(z.object({digest:z.string().regex(/^[a-f0-9]{64}$/),usdc:amount,sol:amount}).strict()).max(100);
/** Local policy reservations only; never reserves on-chain funds. No release/reset API. */
export class CreatorBudget {
  constructor(private readonly root:string,private readonly creator:string){}
  private paths(){const identity=createHash('sha256').update(this.creator).digest('hex');return {file:join(this.root,identity+'.json'),lock:join(this.root,identity+'.lock')};}
  private async read(){
    const {file}=this.paths();
    try {
      const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
      try {if((await handle.stat()).size>20000)throw new Error('Budget file too large');return records.parse(JSON.parse(await handle.readFile('utf8')));}finally{await handle.close();}
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  }
  private totals(values:z.infer<typeof records>){
    const total=values.reduce((sum,value)=>({usdc:sum.usdc+BigInt(value.usdc),sol:sum.sol+BigInt(value.sol)}),{usdc:0n,sol:0n});
    if(total.usdc>CAP.usdc || total.sol>CAP.sol)throw new Error('Budget ledger cap exceeded');return total;
  }
  async spent(){return this.totals(await this.read());}
  async reserve(report:Effects){
    if(!report.verified || !report.maximumDebit || !/^[a-f0-9]{64}$/.test(report.transactionSha256))throw new Error('Unverified review cannot reserve budget');
    await mkdir(this.root,{recursive:true,mode:0o700});const {file,lock}=this.paths();
    // Concurrent or crashed review fails closed; never retry or erase an uncertain reservation.
    const handle=await open(lock,'wx',0o600);const temporary=file+'.pending';
    try {
      const values=await this.read();
      if(values.some(value=>value.digest===report.transactionSha256))throw new Error('Transaction already reserved; no automatic retry');
      const next=records.parse([...values,{digest:report.transactionSha256,usdc:report.maximumDebit.usdcBaseUnits,sol:report.maximumDebit.solLamports}]);
      this.totals(next);
      const pending=await open(temporary,'wx',0o600);
      try {await pending.writeFile(JSON.stringify(next)+'\n');await pending.sync();}finally{await pending.close();}
      await rename(temporary,file);
      // Persist rename before unlocking. Errors leave recovery attention, never permission to spend.
      const directory=await open(this.root,constants.O_RDONLY);try{await directory.sync();}finally{await directory.close();}
    }finally{await handle.close();await unlink(lock);}
  }
}
