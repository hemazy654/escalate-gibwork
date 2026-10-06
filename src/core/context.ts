import { run } from './process.js';
import { redact } from './redact.js';
import type { FailureReport } from './failure.js';
import { repositoryRoot, baselineEntries, baselineText, excludedPath } from './repository.js';

export async function scan(root: string, report: FailureReport) {
  root = await repositoryRoot(root);
  const head = await run('git', ['rev-parse', 'HEAD'], root);
  if (head.code) throw new Error('Commit a baseline before diagnosing');
  const baseline = head.stdout.trim();
  const words = report.task.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const candidates = (await baselineEntries(root, baseline))
    .filter(entry => ['100644', '100755'].includes(entry.mode) && !excludedPath.test(entry.path))
    .map(entry => ({ ...entry, score: report.files.includes(entry.path) ? 100 : words.filter(w => entry.path.toLowerCase().includes(w)).length + (/^(README|package\.json|tsconfig)/.test(entry.path) ? 1 : 0) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const files: { path: string; content: string }[] = [];
  let total = 0;
  for (const entry of candidates.slice(0, 20)) {
    let content: string;
    try { content = await baselineText(root, entry.oid, 32000); }
    catch { continue; } // Binary and oversized context is excluded; validation fails closed instead.
    const bytes = Buffer.byteLength(content);
    if (total + bytes > 128000) continue;
    files.push({ path: redact(entry.path), content: redact(content) });
    total += bytes;
  }
  return { baseline, files };
}
