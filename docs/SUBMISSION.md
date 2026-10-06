# Hackathon submission copy

## Tagline (11 words)

When AI coding stalls, hand off safely and validate human fixes.

## Description

ESCALATE is a TypeScript CLI that helps AI coding agents recover when they repeatedly fail a development task. Instead of losing the debugging history, it turns failed attempts into a bounded, secret-redacted human handoff through Gibwork.

The workflow detects consecutive failures, selects relevant committed files, summarizes attempts and test output, pins the Git baseline, and prepares a bounty draft matching the official Gibwork SDK contract. A candidate human patch is then reviewed and tested against that baseline. Production validation runs inside Docker with networking disabled, resource limits, and no wallet or original repository mounted.

The official `@gibwork/sdk` 0.2.0 is a core runtime dependency. ESCALATE uses its real request construction and response handling for offline submission retrieval. A separate, manually approved Phantom message signature successfully authenticated one real Gibwork discovery read with HTTP 200. Bounty publication, funding, transaction signing and all monetary operations remain intentionally disabled.

Reviewers can run `npm ci` followed by `npm run demo` with Node 22+ and Git. The deterministic demo shows a real retry-policy bug moving from failing to passing tests, with synthetic AI attempts and a mock human submission. Its trusted local runner is clearly labelled as having no isolation; actual Docker validation has been verified separately. PASS remains advisory, so the maintainer decides whether the agent can continue.

## Attach before submission

- Public repository URL: https://github.com/hemazy654/escalate-gibwork.
- Demo recording URL: **pending capture/upload**, using [DEMO.md](DEMO.md).
- Optional terminal screenshot: FAIL→PASS stages with the runner/isolation label visible.
- Optional draft screenshot: redacted context and approval-required/funding-disabled flags.

These are placeholders, not claims that a recording or funded bounty exists. Never attach local wallet/auth evidence or show a wallet approval session to fill a placeholder. Do not republish upstream SDK source or bundled dependencies under the MIT license.
