# Security and privacy

ESCALATE is offline by default. The release candidate never publishes/funds a bounty, creates an intent/submission, requests a transaction signature, approves/rejects work or pays/refunds funds. PASS is advisory; no automatic merge, payout or agent resumption occurs.

## Boundaries

- **Context:** committed Git blobs at a pinned baseline; no worktree substitution or untracked files. Path, mode, binary and size exclusions apply. Selected context is limited to 20 files, 32 KB each and 128 KB total; validation exports are capped separately. Redaction is heuristic. A maintainer must inspect source literals, proprietary code and personal data before sharing a draft.
- **Offline demo:** synthetic failure history, submission and canary; actual compilation/tests and exact patch application. Only the bundled trusted fixture and patch are accepted. Isolation is explicitly **none**, never represented as Docker.
- **Production validation:** network-disabled Docker, read-only root/input, non-root execution, dropped capabilities, no-new-privileges, bounded CPU/memory/PIDs/time/output and forced cleanup. No original repository, wallet, host environment or Docker socket is mounted. Tests/patches remain untrusted; inspect test integrity. Docker is not a VM/kernel security guarantee.
- **Phantom:** manual connect/signMessage clicks through the documented injected browser provider. Loopback-only one-shot bridge with Host/Origin/session/CSP checks and independent Ed25519 verification. No wallet secret access/export. A rejected/expired/ambiguous session is not automatically retried. No transaction-provider method is called. Same-user malware or a compromised checkout/browser is outside this boundary.
- **Live read:** one real SDK 0.2.0 discovery read was verified. The separate opt-in adapter permits one exact GET and no redirects/retries/write endpoints. Raw bodies, public wallet identity, signatures and authorization headers are excluded from evidence. Do not rerun wallet utilities for an offline recording.
- **Spending review:** non-signing cap of 1.50 USDC / 0.01 SOL across durable local-policy reservations. Quote alone never proves effects. Independent read RPC verification is explicit; unrecognized escrow/CPI, unresolved lookup tables, account/rent creation or missing fee data fail closed. Passing review still returns `signingAllowed:false`. The ledger assumes a trusted local checkout/filesystem and is not an on-chain reservation. See [SPENDING-GUARD.md](docs/SPENDING-GUARD.md).

## Public artifacts

`.gitignore` excludes `.escalate/`, environment files (except the harmless `.env.example`), dependencies/build output, local wallet/keypair/auth artifacts, private-key files and local evidence. Ignore rules do not remove files already tracked and cannot protect every possible secret filename. Never force-add wallet material, authentication evidence or a prepared transaction.

Public test fixtures include fake credential assignments/private-key delimiters for redaction tests, a clearly marked unusable demo canary, the RFC 8032 **public** key/signature vector, deterministic dummy public addresses, and public USDC/program/genesis constants. They contain no corresponding private key or real wallet identity. Package-lock integrity hashes are not wallet signatures.

The publication audit found a personal author email in Git commit metadata. It is not a wallet secret, but remains a publication privacy decision. History was not rewritten; see [PUBLICATION.md](docs/PUBLICATION.md).

## Dependencies and reports

ESCALATE source is MIT licensed. Official SDK 0.2.0 is declared UNLICENSED; its licensing concern and previously reported moderate dependency advisories remain unresolved. No dependency upgrade or architecture change is made for submission readiness. Do not bundle/relicense upstream SDK code under ESCALATE's MIT license.

For a suspected vulnerability, use the repository owner's private contact or hosting platform's private reporting channel if configured. Do not post actual credentials, wallet secrets, signatures or private repository context in a public issue. No public reporting address is invented by this repository.
