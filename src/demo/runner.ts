/** Trusted bundled fixture ONLY. This is local execution, never Docker isolation. */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../core/process.js';
import { exportBaseline } from '../core/repository.js';
import { redact } from '../core/redact.js';

const project = fileURLToPath(new URL('../../', import.meta.url));
// In compiled dist/demo this URL resolves to the project root.
export async function runTrustedDemo(root: string, baseline: string, patch: string | undefined) {
  const bundle = resolve(project, 'demo/repository');
  const expectedPatch = await readFile(resolve(project, 'demo/solution.patch'), 'utf8');
  if (patch !== undefined && patch !== expectedPatch) throw new Error('Demo runner accepts only the exact bundled patch');
  const dir = await mkdtemp(join(tmpdir(), 'escalate-demo-validation-'));
  try {
    await exportBaseline(root, baseline, dir);
    // Verify the entire exported tree against the trusted bundled source before host execution.
    const { readdir } = await import('node:fs/promises');
    async function files(path: string): Promise<string[]> {
      const result: string[] = [];
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isDirectory()) result.push(...(await files(join(path, entry.name))).map(p => `${entry.name}/${p}`));
        else if (entry.isFile()) result.push(entry.name);
        else throw new Error('Unsupported demo fixture entry');
      }
      return result.sort();
    }
    const paths = await files(bundle);
    if (JSON.stringify(await files(dir)) !== JSON.stringify(paths)) throw new Error('Demo baseline differs from trusted fixture');
    for (const path of paths) {
      if (!(await readFile(join(dir, path))).equals(await readFile(join(bundle, path)))) throw new Error('Demo baseline differs from trusted fixture');
    }
    if (patch !== undefined) {
      const patchFile = join(dir, 'candidate.patch');
      await writeFile(patchFile, patch);
      for (const args of [['apply', '--check', patchFile], ['apply', patchFile]]) {
        const result = await run('git', args, dir);
        if (result.code) throw new Error(`Bundled patch did not apply: ${redact(result.output)}`);
      }
    }
    // Fixed maintainer-owned compiler and test paths; no package scripts or arbitrary commands.
    const compiler = resolve(project, 'node_modules/typescript/bin/tsc');
    const compiled = await run(process.execPath, [compiler, '-p', join(dir, 'tsconfig.json'), '--typeRoots', resolve(project, 'node_modules/@types')], dir);
    if (compiled.code) throw new Error(`Demo TypeScript compilation failed: ${redact(compiled.output)}`);
    const result = await run(process.execPath, ['--test', 'build/tests/retry.test.js'], dir);
    return { runner: 'trusted-local-demo' as const, isolation: 'none' as const, baseline, patchDigest: patch === undefined ? null : createHash('sha256').update(patch).digest('hex'), verdict: result.code === 0 ? 'PASS' as const : 'FAIL' as const, exitCode: result.code, output: redact(result.output), advisory: true };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
