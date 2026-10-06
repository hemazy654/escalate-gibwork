# Submission-readiness audit

Feature-complete release candidate: `9923a4433d882a01270eeeee17144b1dfc91e951`. This milestone changes documentation, ignore rules and package metadata only. Runtime source, test assertions, demo fixtures, Docker architecture and financial capabilities remain unchanged.

## Tracked content and history

The audit searched all tracked files and 94 unique historical blobs across existing commits for private-key blocks, credential assignments/token formats, seed/recovery-phrase references, authorization headers, base58 address candidates, long hexadecimal signatures, email addresses, local absolute paths and evidence filenames. Matches were inspected, not treated as proof of a leak solely because they matched a pattern.

- No real private key, recovery phrase, usable credential, actual wallet identity, live authorization header/value or private live-auth artifact was found in tracked content/history.
- Credential-looking matches are synthetic redaction tests and the explicitly unusable `DEMO_ONLY_NOT_A_REAL_CREDENTIAL` canary. The private-key test contains delimiters and dummy text, not key material.
- The Ed25519 signature/public-key pair is a public RFC 8032 test vector. Dummy public addresses, public native-USDC/program/genesis identifiers, source-code header names and lockfile integrity hashes are not wallet secrets.
- No `.escalate/`, real `.env`, keypair or private-key/evidence file is tracked or present in the inspected Git history. Public docs retain only the harmless live-read outcome (method/version/time/status/count), not the raw evidence.
- Machine-specific checkout paths were removed from current documentation. Historical commits still contain those old documentation paths.
- Git commit author/committer metadata contains a personal email/name. It is not a credential, but publishing the existing history would disclose it. Checkpoint history was deliberately preserved, not silently rewritten.

This is a scoped repository hygiene review, not a guarantee that heuristic scanning detects every conceivable secret. Ignore rules do not remove already-tracked data or protect arbitrary filenames.

## Publication decision

**The current tracked source snapshot is ready for public review**, with the documented dependency/licensing limitations. **Publishing the existing full Git history still needs the owner's privacy decision**, because it includes personal metadata and historical machine paths. Publication target: https://github.com/hemazy654/escalate-gibwork. The owner separately authorized replacing its placeholder contents with this clean source snapshot. No private local Git history is copied.

If history privacy matters, publish a clean source snapshot in a new public repository, leaving this private checkpoint history intact. Do not copy `.git`, `node_modules`, `dist`, `.env`, `.escalate` or raw local evidence. For example, after the readiness commit:

```sh
# Run in the release checkout. The archive contains committed source only, no Git history.
mkdir -p .escalate/submission
git archive --format=tar.gz --output=.escalate/submission/escalate-source.tar.gz HEAD
```

Extract that archive into a new folder and inspect it. Before its first Git commit, configure your chosen public name and hosting-provider no-reply email locally. Use the provider's actual no-reply address; this document does not invent your identity. Publishing is a separate manual action. Existing commit hashes are provenance references, not a requirement to upload private history.

## Metadata and license

ESCALATE has a Node >=22 engine requirement, TypeScript CLI bin entry, consistent lockfile, descriptive keywords and MIT license with contributor attribution. The package is marked `private:true` to prevent accidental npm publication, with an explicit distribution file list. Package repository/homepage links identify the existing public GitHub destination; no personal author field is added.

Official SDK 0.2.0 remains UNLICENSED. ESCALATE's MIT license covers its own source, not upstream code. No dependencies are vendored; seek upstream licensing clarification before redistributing/bundling SDK code. Previously observed moderate dependency advisories remain documented; no upgrade or architecture change was made here.

## Owner's final manual steps

1. Decide whether existing Git-history metadata is acceptable, or publish the clean snapshot instead.
2. Publish the source repository and confirm a clean clone runs `npm ci` and `npm run demo` on Node 22+ with Git.
3. Record the 2–3 minute offline walkthrough using [DEMO.md](DEMO.md); crop personal prompts/artifact paths, keep simulation/isolation labels visible, and do not open wallet/live utilities.
4. Upload the video, optionally attach two honest screenshots, and verify reviewer access to all links.
5. Paste the 213-word description and 11-word tagline from [SUBMISSION.md](SUBMISSION.md), plus the actual public repository/video links, into the hackathon form.
6. Keep all local wallet/auth evidence and budget files private. No real bounty or transaction is needed for this submission.

The final local suite is `npm run check`, `npm test`, `npm run build`, `npm run test:docker`, plus `git diff --check`. Docker tests require a running daemon and previously prepared trusted image; they use offline Gibwork transport and perform no wallet operation. See [DOCKER.md](DOCKER.md) for preparation on another machine.
