# Phase A: authenticated Gibwork read verified

SDK **0.2.0** successfully performed `tasks.listAvailable({page:1,limit:1})` against `https://sdk.gib.work/v2/int/tasks/available?page=1&limit=1` on 2026-10-06. The recorded operation-start timestamp is `02:08:04.707 UTC`. Result: **HTTP 200**, expected page schema, authentication succeeded, **one live request**, message signing occurred, transaction signing did not. No incompatibility was observed for this method; no other live SDK method is claimed verified.

This public summary intentionally excludes wallet identity, signature, nonce, authorization headers and response/task contents. The actual local evidence stays in ignored `.escalate/live-readonly-evidence.json`; do not attach it to a public submission.

## Authentication and supported bridge

The SDK requires a fresh 64-byte Ed25519 message signature over its exact operation, method, path, wallet public address, timestamp, nonce and normalized query hash. This is not a Solana transaction. A public address or static pre-signed message alone is insufficient. No raw private-key, seed, key file or API-key configuration is required by ESCALATE.

The verified external signer is Phantom's official injected Solana provider in a top-level Brave tab. Manual connection and message approval occur in Phantom. The local bridge forwards only the public key/signature and independently verifies the signature. See [PHANTOM.md](PHANTOM.md) for the exact mechanism and approval instructions. Phantom secrets never enter ESCALATE, Terminal or `.env`.

## Safe defaults and explicit opt-in

- Normal `diagnose`, `create`, `review` and `demo` remain offline.
- `npm run verify:live` defaults to offline. Setting `ESCALATE_VERIFY_MODE=live-readonly` alone returns `configuration-required`: this standalone command intentionally has no signer loader.
- The separate `npm run verify:live:phantom` utility requests manual approval for one allowlisted discovery read. It is unnecessary for first-run setup, judging or recording. Do not rerun it to reproduce the offline demo.
- `npm run verify:phantom` checks a non-authorizing message signature only and sends no Gibwork request.

The live adapter exposes no SDK client/write methods. It accepts only the exact GET above, validates the SDK challenge, refuses transaction signing, disables redirects/retries, bounds the response at 128 KB and uses a 10-second SDK request timeout after signing. A session expires after five minutes and closes after accepted signing. No authorization material or raw response body is logged/persisted.

The adapter records 401/403 as unsuccessful authentication/access verification. A successful HTTP 200 with the expected schema is evidence of compatibility with the authenticated endpoint, not an independent audit of the service's enforcement.

## Limits

Tests use injected mock transports and dummy signatures; they do not repeat the real live read. Real read success does not verify task creation, fee quotes, eligibility, funding, submissions, payout, refund or settlement. Phase B remains pre-flight only: no prepare POST, transaction or task publication occurred. The SDK remains UNLICENSED and dependency advisories remain unresolved. See [GIBWORK.md](GIBWORK.md), [PREFLIGHT.md](PREFLIGHT.md) and [SECURITY.md](../SECURITY.md).
