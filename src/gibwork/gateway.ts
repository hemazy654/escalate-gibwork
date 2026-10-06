import { GibworkClient } from '@gibwork/sdk';
import { createKeypairSigner } from '@gibwork/sdk/node';
import type { CreateTaskInput } from '@gibwork/sdk';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { redact } from '../core/redact.js';
export const submissionSchema = z.object({id:z.string().min(1).max(200), taskId:z.string().min(1).max(200), content:z.string().max(64000), status:z.string().max(40)});
export const fixtureSchema = z.array(submissionSchema).max(100);
export type Submission = z.infer<typeof submissionSchema>;
/** Real SDK request construction/auth/response path, with an exclusively in-memory transport. */
export function mockGateway(fixtures:Submission[] = []) {
  const signer = createKeypairSigner(randomBytes(32));
  signer.signTransaction = async () => { throw new Error('Financial operations are disabled'); };
  const client = new GibworkClient({signer, timeoutMs:5000, fetch:async (input, init) => {
    const url = new URL(String(input));
    if (init?.method !== 'GET' || !/^\/v2\/int\/tasks\/[^/]+\/submissions$/.test(url.pathname)) throw new Error('Network and write operations are disabled');
    const taskId = decodeURIComponent(url.pathname.split('/')[4] ?? '');
    const results = fixtures.filter(s=>s.taskId===taskId);
    return new Response(JSON.stringify({results,page:1,limit:100,total:results.length,lastPage:1}), {status:200,headers:{'content-type':'application/json'}});
  }});
  return {
    async submissions(taskId:string) {
      const page = await client.submissions.list(taskId,{page:1,limit:100});
      return fixtureSchema.parse(page.results).map(s=>({...s,content:redact(s.content)}));
    },
    async create(_input:CreateTaskInput):Promise<never> { throw new Error('Live creation and funding are disabled. Explicit human approval and verified integration are required in a future release.'); }
  };
}
/** Content is a serialized, already-redacted brief. Escape HTML without re-redacting JSON. */
export function taskInput(title:string, content:string, amount:string, mintAddress:string):CreateTaskInput {
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(amount) || Number(amount)<=0) throw new Error('Reward must be a positive decimal string');
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintAddress)) throw new Error('Invalid token mint address');
  return {title:redact(title).slice(0,120),content:`<pre>${content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`,tags:['Development'],payment:{amount,mintAddress},minSubmissionAmount:amount};
}
