# Phase A: Phantom in Brave → local message-signing check

Historical safe checkpoint: `8a654a5`; feature-complete release candidate: `9923a44`. The standalone signing check does not alter the offline commands or Docker path. No Gibwork API request is made by it.

## Supported mechanism

Phantom documents its browser-extension Solana provider at `window.phantom.solana`, injected into HTTPS and localhost/127.0.0.1 top-level browser pages. Node has no browser window or access to that injected provider; no supported direct extension-to-headless-Node API was identified in the inspected documentation.

Use the traditional injected provider in a temporary loopback page, with explicit `connect()` and `signMessage(Uint8Array, 'utf8')` calls. This avoids extension internals, Brave profile inspection, debugger access, key export, another wallet, Phantom Portal registration, embedded-wallet login or transaction APIs.

Official references inspected on 2026-10-06:

- https://docs.phantom.com/solana/integrating-phantom
- https://docs.phantom.com/solana/detecting-the-provider
- https://docs.phantom.com/solana/establishing-a-connection
- https://docs.phantom.com/solana/signing-a-message

The localhost forwarding protocol is ESCALATE's implementation; the provider calls are Phantom's officially documented mechanism. Phantom has not independently audited this bridge.

## Exact clicks and approvals

1. In Terminal:

   ```sh
   # Run from the cloned repository root
   npm run verify:phantom
   ```

2. Leave Terminal running. Copy the newly printed `http://127.0.0.1:<port>/#<session>` URL into a **normal, top-level Brave tab**, using the Brave profile where Phantom is installed. Keep the fragment intact when opening it. The link expires after five minutes; it is an ephemeral local capability, not a wallet secret. Do not share it.
3. On the helper page, click **1. Connect Phantom**. Unlock Phantom in its extension popup if needed. Choose the intended Solana account and approve the **connection/public-address sharing** request. If it is already trusted, Phantom may connect without a new approval dialog.
4. Review the exact plaintext challenge displayed on the page. Click **2. Sign verification message**. Phantom should show a **message-signing** approval. The message starts:

   ```text
   ESCALATE signing-path verification only
   No Gibwork request or transaction will be sent.
   No funds, approvals, payouts or refunds are authorized.
   ```

   It also contains the local origin, random nonce and expiry. Approve only this message. Decline any transaction, transfer, fee, or different message. Do not disable Phantom security protections to proceed.
5. Node verifies the signature against the exact challenge and public key. Successful Terminal output reports `result: "signature-verified"`, `ed25519Verified: true`, `signatureLength: 64`, and `liveGibworkRequests: 0`.
6. Click **Disconnect** on the helper page and close the tab. You can also revoke the localhost connection in Phantom's connected-app settings. Ctrl+C cancels a pending session; expiry also stops the server. Restart the command for a fresh link if the session expires or the account changes.

The helper has no automatic wallet connection/signing on page load. Both actions require a click. It never asks for a recovery phrase or private key; you do not need to paste a signature or public address into Terminal.

## Security boundaries

- Binds only `127.0.0.1` on a random port; validates Host against that exact origin.
- Uses a random, in-memory session capability passed in the URL fragment; removes it from browser history after page load. Requests use a custom header, with no CORS support. Signature POST requires the exact origin and JSON content type.
- Uses no third-party browser scripts, cookies, localStorage or sessionStorage. CSP forbids framing and external page network calls.
- Generates a fixed-purpose challenge, never accepts arbitrary messages, and has no Gibwork client/transaction methods. The challenge cannot authenticate a Gibwork request.
- Limits response size to 2 KB, validates public-key/signature shapes, verifies Ed25519 with Node crypto, rejects mismatched messages and closes after one accepted signature or expiry.
- Checks the connected account before/after approval. Changed accounts require a new session.
- Only the public key and 64-byte signature are returned to Node in memory. Raw signatures, public addresses, challenges and session capabilities are not persisted in evidence. The CLI clears the signature bytes after verification. JavaScript memory clearing is best effort, not a memory-forensics guarantee.
- `.escalate/phantom-signing-evidence.json` contains sanitized result flags and timestamps only. It is ignored by Git. A connection may remain trusted inside Phantom until you revoke it; the bridge stores no wallet connection state.

Same-user malware, a compromised browser/extension or an altered local checkout is outside this loopback protocol's protection. Preserve and inspect the checkpoint and use Phantom's own approval UI.

## Verification and stopping point

Strict TypeScript checks and targeted tests verify public Ed25519 signature vectors, wrong-message/key rejection, host/origin/session restrictions, size limits, expiry, fixed browser actions and public-only response forwarding. Tests do not generate private keys or involve your wallet. Browser-flow tests use a mock provider; they do not demonstrate real Phantom approval.

The actual Brave extension signing path was manually verified on 2026-10-06. Its signing-only command returns `signature-verified` after Node verifies the exact challenge. This check stops there: it neither calls `verifyReadOnly` nor contacts Gibwork, and does not cache a signature for later use. A later, separately authorized read must request a fresh signature for the SDK's exact authentication message. Phase B and all monetary operations remain disabled.

## Separately authorized one-shot live read

`npm run verify:live:phantom` explicitly starts one authenticated production GET using SDK 0.2.0 `tasks.listAvailable({ page: 1, limit: 1 })`. Normal CLI commands and `verify:live` still default offline. This command does not provide any write capability.

Open its temporary URL in Brave and connect Phantom. The page previews the **unaltered SDK authentication message** before you click **Sign Gibwork read authentication**. Phantom receives that same UTF-8 message. It starts `gibwork:view-available-tasks`, specifies `method:GET` and `path:/v2/int/tasks/available`, and includes the connected public address, SDK timestamp, nonce and query hash. Do not approve any transaction prompt.

The bridge binds the challenge to the connected address and independently verifies the signature. Only then can the existing guarded adapter send its single GET to `https://sdk.gib.work/v2/int/tasks/available?page=1&limit=1`. The server closes after acceptance; there is no authentication/request retry. On rejection, expiry, HTTP failure or ambiguous result, stop and inspect sanitized evidence rather than repeating automatically. A fresh process requires a fresh manual signature.

The ignored `.escalate/live-readonly-evidence.json` records version, action, endpoint, timestamp, result/HTTP status, authentication flags, message-signing flag, transaction-signing flag and live request count. It contains no public address, signature, nonce, response body or authorization headers. Signature bytes are cleared after the SDK finishes. All write and monetary operations remain disabled; this command does not enable further background requests.

## Phase A live verification result

On 2026-10-06 at 02:08:04.707 UTC (recorded SDK operation start), SDK **0.2.0** successfully exercised `tasks.listAvailable({ page: 1, limit: 1 })` against `https://sdk.gib.work/v2/int/tasks/available?page=1&limit=1`. The user manually approved the exact SDK authentication message in Phantom. HTTP status was **200**, authentication succeeded, and the response passed the adapter’s page schema. Exactly **one** live request occurred; message signing occurred and transaction signing did not. No incompatibility was observed for this method; other SDK methods were not tested.

The session closed after the read. No response contents, public address, signature or authorization headers are included in this record. The original safe checkpoint `8a654a5` remains in history. Offline defaults remain unchanged, and write/monetary capabilities and Phase B remain disabled. The successful evidence is stored locally in the ignored `.escalate/live-readonly-evidence.json`.
