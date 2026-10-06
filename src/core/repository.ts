import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './process.js';

export const excludedPath = /(^|\/)(\.env[^/]*|\.git|\.aws|\.ssh|\.npmrc|\.netrc|node_modules|dist|\.escalate|.*\.(pem|key|p12|pfx)|.*(?:credentials|keypair|wallet|secret).*|package-lock\.json)(\/|$)/i;
const sensitivePath = /(^|\/)(\.env[^/]*|\.git|\.aws|\.ssh|\.npmrc|\.netrc|.*\.(pem|key|p12|pfx)|.*(?:credentials|keypair|wallet|secret).*)(\/|$)/i;
export function checkBaseline(baseline: string): void {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(baseline)) throw new Error('Validation requires a pinned 40- or 64-character Git baseline');
}
export async function repositoryRoot(root: string): Promise<string> {
  root = await realpath(root);
  const result = await run('git', ['rev-parse', '--show-toplevel'], root);
  if (result.code || await realpath(result.stdout.trim()) !== root) throw new Error('Use the Git repository root for --repo');
  return root;
}
export async function baselineEntries(root: string, baseline: string) {
  checkBaseline(baseline);
  const tree = await run('git', ['ls-tree', '-rz', baseline], root);
  if (tree.code) throw new Error('Cannot read baseline');
  return tree.stdout.split('\0').filter(Boolean).map(entry => {
    const match = /^(\d{6}) (blob|commit) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('Unsupported Git tree entry');
    return { mode: match[1]!, oid: match[3]!, path: match[4]! };
  });
}
export async function baselineText(root: string, oid: string, limit: number) {
  const result = await run('git', ['cat-file', 'blob', oid], root, 15000, limit);
  if (result.code || result.stdout.includes('\0')) throw new Error('Baseline file is binary or too large');
  return result.stdout;
}
/** Shared committed snapshot export; no worktree files or symlink traversal. */
export async function exportBaseline(root: string, baseline: string, destination: string) {
  root = await repositoryRoot(root);
  await mkdir(destination, { recursive: true });
  let bytes = 0;
  for (const entry of await baselineEntries(root, baseline)) {
    if (!['100644', '100755'].includes(entry.mode)) throw new Error('Symlinks and submodules are not supported in validation');
    if (entry.path.startsWith('/') || entry.path.split('/').some(p => p === '..') || sensitivePath.test(entry.path)) throw new Error('Baseline includes a sensitive or unsupported path; use a sanitized baseline');
    const content = await baselineText(root, entry.oid, 1000000);
    bytes += Buffer.byteLength(content);
    if (bytes > 10000000) throw new Error('Baseline exceeds 10 MB limit');
    const path = join(destination, entry.path);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content, { mode: entry.mode === '100755' ? 0o755 : 0o644 });
  }
}
