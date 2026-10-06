#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../core/process.js';
import { redact } from '../core/redact.js';
import { runTrustedDemo } from './runner.js';
import { fixtureSchema } from '../gibwork/gateway.js';
import type { brief } from '../core/brief.js';
import type { CreateTaskInput } from '@gibwork/sdk';

const project = fileURLToPath(new URL('../../', import.meta.url));
const machine = process.argv.includes('--json');
function step(title: string, lines: string[]) {
  if (!machine) console.log(`\n${title}\n${lines.map(line => `  ${line}`).join('\n')}`);
}
async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--json')) throw new Error('Demo accepts only --json; no external code or patches are accepted');
  const temp = await mkdtemp(join(tmpdir(), 'escalate-story-'));
  const repo = join(temp, 'repository');
  const artifacts = resolve(project, '.escalate/demo');
  try {
    await cp(resolve(project, 'demo/repository'), repo, { recursive: true });
    async function git(args: string[], environment: Record<string,string> = {}) {
      const result = await run('git', args, repo, 15000, 128000, environment);
      if (result.code) throw new Error(`Demo Git setup failed: ${redact(result.output)}`);
      return result.stdout.trim();
    }
    await git(['-c', 'core.autocrlf=false', 'init', '--template=', '--object-format=sha1', '--initial-branch=main']);
    await git(['-c', 'core.autocrlf=false', 'add', '.']);
    await git(['-c', 'user.name=ESCALATE Demo', '-c', 'user.email=demo@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Fixture: broken retry policy'], { GIT_AUTHOR_DATE: '2026-10-06T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-06T00:00:00Z' });
    const baseline = await git(['rev-parse', 'HEAD']);
    step('ESCALATE · safe offline end-to-end demo', ['Fixture: API client retry policy', 'No network, real wallet, bounty publication or monetary operations.', 'Validation: TRUSTED LOCAL DEMO — isolation: NONE (not Docker).']);
    const before = await runTrustedDemo(repo, baseline, undefined);
    assert.equal(before.verdict, 'FAIL', 'The genuine bug must fail the baseline tests');
    step('1 / AI fails repeatedly', ['Baseline tests: FAIL (client errors are retried).', 'Three recorded attempts: threshold change, narrow special cases, missing upper bound.', 'Attempt history is a plausible synthetic report; current test results are real.']);
    async function cli(args: string[]) {
      const result = await run(process.execPath, [resolve(project, 'dist/cli.js'), ...args], project);
      if (result.code) throw new Error(`ESCALATE command failed: ${redact(result.stderr)}`);
      return JSON.parse(result.stdout) as unknown;
    }
    const report = resolve(project, 'demo/failure.json');
    const diagnosis = await cli(['diagnose', '--report', report, '--repo', repo]) as { failure: { escalate: boolean; consecutive: number }; context: { baseline: string; files: {path:string;content:string}[] } };
    assert.equal(diagnosis.failure.escalate, true);
    assert.equal(diagnosis.failure.consecutive, 3);
    assert.equal(diagnosis.context.baseline, baseline);
    step('2 / ESCALATE detects failure', ['escalate diagnose → escalation required: true; consecutive failures: 3']);
    const created = await cli(['create', '--report', report, '--repo', repo, '--out', join(temp, 'drafts'), '--amount', '25.00', '--mint', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']) as { file: string };
    const bountyText = await readFile(created.file, 'utf8');
    const bounty = JSON.parse(bountyText) as { draft: ReturnType<typeof brief>; gibworkInput: CreateTaskInput; financialOperationsEnabled: boolean; approvalRequired: boolean };
    assert.equal(bounty.financialOperationsEnabled, false);
    assert.equal(bounty.approvalRequired, true);
    assert.equal(bounty.draft.baseline, baseline);
    assert.equal(bounty.draft.attempts.length, 3);
    assert.ok(bounty.draft.files.some(file => file.path === 'src/retry.ts'));
    assert.ok(bounty.draft.files.some(file => file.path === 'tests/retry.test.ts'));
    assert.ok(bounty.draft.files.some(file => file.path === 'src/diagnostics.ts' && file.content.includes('[REDACTED]')));
    assert.ok(!bountyText.includes('DEMO_ONLY_NOT_A_REAL_CREDENTIAL'), 'Synthetic canary must not escape');
    // Gibwork content must retain valid, complete JSON after redaction and HTML escaping.
    const decodedContent = bounty.gibworkInput.content.slice(5, -6).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    assert.deepEqual(JSON.parse(decodedContent), bounty.draft);
    step('3 / Repository context is safely packaged', [`Pinned baseline: ${baseline}`, `Selected tracked files: ${bounty.draft.files.map(file => file.path).join(', ')}`, 'Synthetic API_KEY canary → [REDACTED] in source and failed test output.', 'Three failed attempts retained; package and test context included.']);
    step('4 / Gibwork-compatible bounty draft is produced', ['escalate create → proposed reward: 25.00 USDC; funded: NO', `Context fingerprint: ${bounty.draft.digest}`, 'Human approval required. Creation/signing/payment are disabled.']);
    const submissionsPath = resolve(project, 'demo/submissions.json');
    const reviewed = await cli(['review', 'retry-policy-task', '--fixtures', submissionsPath]) as { submissions: unknown };
    const submissions = fixtureSchema.parse(reviewed.submissions);
    const selected = submissions.find(submission => submission.id === 'retry-policy-human-fix');
    assert.ok(selected, 'SDK transport must return the selected submission');
    const patch = await readFile(resolve(project, 'demo/solution.patch'), 'utf8');
    const patchDigest = createHash('sha256').update(patch).digest('hex');
    assert.ok(selected.content.includes(patchDigest) && selected.content.includes(patch), 'Submission must contain the exact local candidate patch and digest');
    step('5 / Human submission appears through Gibwork', ['escalate review → official @gibwork/sdk submissions.list, offline transport', `Submission: ${selected.id}`, 'Candidate: retry only 429 or the inclusive 500–599 range.', `Local patch SHA-256 matches submission: ${patchDigest}`]);
    const after = await runTrustedDemo(repo, baseline, patch);
    assert.equal(after.verdict, 'PASS', 'The submitted patch must fix the regression');
    assert.equal(after.patchDigest, patchDigest);
    assert.equal(await git(['rev-parse', 'HEAD']), baseline);
    assert.equal(await git(['status', '--porcelain']), '', 'Original fixture repository must stay untouched');
    await mkdir(artifacts, { recursive: true, mode: 0o700 });
    const result = { mode: 'mock', runner: 'trusted-local-demo', isolation: 'none', financialOperationsEnabled: false, baseline, contextDigest: bounty.draft.digest, taskId: selected.taskId, submissionId: selected.id, patchDigest, before, after };
    const outputs: Record<string, unknown> = { 'diagnosis.json': diagnosis, 'bounty.json': bounty, 'review.json': reviewed, 'validation.json': result };
    for (const [name, value] of Object.entries(outputs)) await writeFile(join(artifacts, name), JSON.stringify(value, null, 2)+'\n', { mode: 0o600 });
    step('6 / Candidate is validated → tests PASS → AI can continue', ['Trusted local demo runner applied the exact patch to a disposable committed snapshot.', 'TypeScript compiled; both tests passed. Baseline was FAIL; candidate is PASS.', 'Isolation: NONE. Production escalate review still requires Docker.', 'Verdict is advisory; AI may continue after maintainer review. No automatic merge/payout.', `Artifacts: ${artifacts}`]);
    if (machine) console.log(JSON.stringify(result, null, 2));
  } finally { await rm(temp, { recursive: true, force: true }); }
}
main().catch((error: unknown) => { console.error(JSON.stringify({level:'error',event:'demo.failed',message:redact(error instanceof Error ? error.message : 'Unknown error')})); process.exitCode=1; });
