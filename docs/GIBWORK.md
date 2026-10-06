# Gibwork verification notes

Inspected on 2026-10-06 before adapter implementation:

- Official published package: https://www.npmjs.com/package/@gibwork/sdk
- Installed `@gibwork/sdk` package.json, README, `dist/index.d.ts`, `dist/node.d.ts`, and implementation `dist/chunk-VOROKJEK.js` (version 0.2.0).
- Official MCP documentation: https://www.npmjs.com/package/@gibwork/mcp (documents read-only registration and Node 22 requirement).
- Official documentation repository: https://github.com/gibwork/gibwork-docs

Registry/package source was used when the npm web page returned HTTP 403. Package metadata is public despite stale README language calling the package private. Current package license is UNLICENSED. Lockfile records the registry URL and integrity.

## Verified contracts used

`GibworkClient({ signer, fetch, timeoutMs })` accepts an injectable fetch transport and WalletSigner. `createKeypairSigner` is exported by `@gibwork/sdk/node`. The offline gateway uses an ephemeral random test signer exclusively behind an in-memory transport and rejects transaction signing. The separate Phase A utility uses an existing Phantom wallet through its official injected browser provider, receiving only the public address and message signature; it never imports private keys.

`client.submissions.list(taskId, {page, limit})` returns `Paginated<TaskSubmission>` with `results`, `page`, `limit`, `total`, `lastPage`. SDK source constructs a GET to `/v2/int/tasks/{taskId}/submissions` with wallet authentication. ESCALATE mocks that endpoint in memory, validates response records and redacts content. The transport rejects every other method/path. No global fetch fallback exists.

`CreateTaskInput` requires `title`, `content`, `tags`, `payment:{mintAddress,amount}` and `minSubmissionAmount`. ESCALATE produces this typed input locally. It never invokes `tasks.create` or even `tasks.prepareCreate`.

Upstream `tasks.create`, `tasks.refund` and `submissions.approve` perform monetary prepare/sign/submit workflows. Submission creation may also charge a participation fee. All these remain unreachable through ESCALATE commands. A future approval flow must account for upstream ambiguous-submit errors and authoritative status recovery rather than blind retries.

## Hackathon overlap review

Read these public repository descriptions and command lists:

- https://github.com/ranadheer-designs/gibwork-bounty-autopilot — bounty lifecycle management and issue sync.
- https://github.com/ranadheer-designs/gibwork-devops-kit — SDK/CLI/MCP tooling and TODO-driven triage.
- https://github.com/ClaytonPetrosian/gibwork-release-gate — App Store release checks and bounty discovery.
- https://github.com/shivaji43/gibwork-mcp — task fetching/creation through MCP.

ESCALATE centers on consecutive AI failure evidence, bounded/redacted repository handoff and isolated validation against a pinned baseline. This differs from the described use cases, but public search is not an exhaustive originality guarantee. Generic task creation and review necessarily overlap platform features.

## Verification boundary — release candidate

**Verified:** installed SDK 0.2.0 contracts, SDK-backed offline retrieval, deterministic FAIL→PASS demo, actual Docker isolation/runtime checks, real Phantom Ed25519 message signing, and exactly one real production `tasks.listAvailable({page:1,limit:1})` GET to `https://sdk.gib.work/v2/int/tasks/available?page=1&limit=1`. The live read returned HTTP 200 with the expected schema and successful authentication on 2026-10-06; no transaction signature occurred. No incompatibility was observed for this single method. Sanitized result summary is in [LIVE-READONLY.md](LIVE-READONLY.md); private local evidence is not committed.

**Offline/synthetic:** product-command submission transport, demo human submission, AI attempt history and credential canary. The official SDK constructs/parses the mocked requests, but no live submission retrieval is claimed. Demo tests are real; its local fixture runner has no isolation. Production review uses Docker.

**Unverified/disabled:** task prepare/create/fund, actual fee quotes, reward minimums, participation eligibility, monetary transactions, payout, refund and settlement. `prepareCreate` creates an intent through POST; no documented guarantee establishes absence of external side effects. It has not been called. Phase B is pre-flight only; the local spending guard refuses unverified effects and all transaction signing remains disabled. See [PREFLIGHT.md](PREFLIGHT.md), [SPENDING-GUARD.md](SPENDING-GUARD.md) and [security](../SECURITY.md).

The SDK remains UNLICENSED and previously observed dependency advisories remain unresolved. Read success does not grant redistribution permission or validate financial operations. Existing hackathon comparisons above are scoped to the prior inspection, not an exhaustive originality guarantee.
