import { createHash } from 'node:crypto';
import type { FailureReport } from './failure.js';
import { redact } from './redact.js';
import type { scan } from './context.js';
export function brief(report:FailureReport, context:Awaited<ReturnType<typeof scan>>) {
  const safe = { task:redact(report.task), attempts:report.attempts.map(a=>({...a,summary:redact(a.summary),output:redact(a.output)})) };
  const body = { version:1, mode:'mock', task:safe.task, baseline:context.baseline, attempts:safe.attempts, files:context.files, acceptance:['Apply a minimal patch against the pinned baseline','Pass the maintainer-supplied test command in the isolated runner','Do not change tests or dependencies without maintainer review'] };
  const serialized = JSON.stringify(body);
  return { ...body, digest:createHash('sha256').update(serialized).digest('hex') };
}
