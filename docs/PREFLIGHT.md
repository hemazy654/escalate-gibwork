# Milestone 4 Phase B — PRE-FLIGHT ONLY

Inspected 2026-10-06. No Gibwork API request, task mutation, wallet signature, transaction, publication or funding was performed during this pre-flight. Checkpoint `8a654a5` remains intact. This document is a proposal, not an executable funding configuration or authorization.

## Sources and confidence

- Installed official `@gibwork/sdk` 0.2.0: README, package metadata, `dist/index.d.ts` and `dist/chunk-VOROKJEK.js`. Public npm registry `latest` also reports 0.2.0 and `UNLICENSED`: https://registry.npmjs.org/@gibwork/sdk/latest
- Current official creation guide: https://docs.gib.work/getting-started/create-your-first-bounty.md
- Official supported-reward description: https://docs.gib.work/getting-started/frequently-asked-questions/how-to-create-a-task.md
- Official participant guide: https://docs.gib.work/getting-started/participate-in-a-bounty.md
- Official documentation repository: https://github.com/gibwork/gibwork-docs
- Circle's native USDC addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Solana transaction fees: https://solana.com/docs/core/fees/fee-structure

The official guides describe SPL-token rewards but publish no exhaustive mint allowlist, minimum bounty, minimum per-submission reward, fixed creator fee, refund fee, refund waiting period or creator gas sponsorship guarantee. SDK task normalization does not establish those service-side limits. A successful discovery GET in Phase A proves read authentication only. It does not verify transaction funding, the deployment cluster, fee payer or refund eligibility.

## Amounts, tokens, network and fees

1. **Minimum supported bounty:** unconfirmed. The guide's 25 USDC example is explicitly illustrative. The SDK README's below-$5 deadline limitation does not establish a minimum. Do not infer that 1 USDC or the smallest token unit is accepted.
2. **Tokens:** official documentation says Solana SPL tokens; SDK takes a mint string and does not enumerate supported assets. USDC is the official SDK creation example. Select only Circle-issued native USDC, mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, for this proposal. Other tokens/mints remain unverified. This mint is Solana mainnet USDC; no bridged token or devnet token substitution.
3. **Network:** intended test is production API (`production:true`, `x-gibwork-environment:prod`) with Solana mainnet-beta USDC. This is an inference from the official example/mint, not a verified deployment/RPC mapping. The SDK selects stage/prod API environment, not a client RPC cluster. Before any later signature, verify the actual transaction's cluster/blockhash/programs against mainnet. Stage is not established as devnet.
4. **SOL:** message signatures and API reads have no on-chain fee. Broadcast create/fund, participant fee payment, payout and refund transactions incur Solana fees. Someone must pay SOL; participant network costs are documented as sponsored. Creator sponsorship is unconfirmed. Base fee is currently 5,000 lamports (0.000005 SOL) per charged signature plus any priority fee; failed transactions also consume fees. Account/escrow creation can require additional rent deposits. No exact creator SOL requirement can be computed without a decoded transaction and read-only fee/rent inspection.
5. **Platform fees:** task prepare returns `paymentQuote {token, fundingAmount, platformFee:{percent,amount}, totalDebit}`. Refund prepare returns `refundQuote {token,grossRefundAmount,platformFee,netRefundAmount}`. Payout prepare returns `approvalQuote {token,grossApprovalAmount,platformFee,referralFee,netPayoutAmount,closeTask}`. Rates are service quotes, not constants exposed by this SDK. Do not assume any of them is zero or that quote strings include SOL rent/gas. Prepare calls are POST mutations and were NOT used to obtain a quote here.
6. **Submission amounts:** `minSubmissionAmount` is the task's minimum reward allocation, distinct from the participant fee. Proposed input: `"1.00"`, matching the entire reward for one accepted solution; supported minimum remains unconfirmed. Discovery returns amount fields in base units; creation examples use decimal display strings. SDK README documents an active platform wallet, eligibility and currently **0.15 USDC per participant submission**, with sponsored network costs. Future `fee.totalDebit`, mint and destination must be inspected. This fee is paid by the participant, not inherently by the creator. The mobile-app fee path may differ; confirm the actual UI/quote before inviting someone to pay. Only intent status `fulfilled` proves SDK submission creation; a taskSubmissionId or HTTP 200 alone does not.

## Exact proposed SDK sequence — inspection only

Do not call the convenience `tasks.create()` in a future approval flow: it immediately proceeds from prepare to signing/submission. Separate phases permit a second human review of the concrete quote and transaction.

| Step | SDK call | Request | Signature |
| --- | --- | --- | --- |
| Creator prepare | `tasks.prepareCreate(input)` | POST `/v2/int/tasks` | message `gibwork:create-task-intent` |
| Creator funding | `signPreparedTransaction(prepared.serializedTransaction, signer)` | local deserialization/signing | one versioned transaction signature |
| Creator submit | `tasks.submitCreate(prepared.intentId, signedTransaction)` | POST `/v2/int/tasks/{intentId}/submit` | no additional message signature in 0.2.0; sends signed transaction |
| Confirm content | `tasks.get(taskId)` | GET `/v2/int/tasks/{taskId}` | message `gibwork:view-task` |
| Participant prepare | `submissions.prepareCreate(taskId, {content,idempotencyKey})` | POST `/v2/int/tasks/{taskId}/submission-intents` | message `gibwork:create-task-submission-intent` |
| Participant fee | `signPreparedTransaction(intent.serializedTransaction, participantSigner)` | local signing for a pending intent only | one participant transaction signature |
| Participant submit | `submissions.submitCreate(taskId,intentId,{paymentAttemptId,signedTransaction})` | POST `/v2/int/tasks/{taskId}/submission-intents/{intentId}/submit` | no additional message signature |
| Read human work | `submissions.list(taskId,{page:1,limit:1})` | GET `/v2/int/tasks/{taskId}/submissions?page=1&limit=1&pageAll=false` | message `gibwork:view-task-submissions` |
| Local validation | existing Docker validator with maintainer-selected local patch, pinned baseline and trusted image | no Gibwork operation | none |

For the smallest happy path, the creator approves **three message signatures** (prepare, task get, submissions list) and **one transaction signature**; the SDK participant approves **one message and one transaction**. Four messages/two wallet transaction approvals across two parties; service co-signatures/fee payer are unknown. The participant may instead submit manually in the official app; its exact signing prompts cannot be inferred from SDK source. Do not automate either party's approval.

SDK message template is the unmodified newline-separated operation, `method`, `path`, resource fields where applicable, `walletAddress`, `timestamp`, `nonce`, and `payloadHash` (POST) or `queryHash` (GET). PrepareCreate hashes normalized/sanitized input including public wallet address. Resource fields include taskId for task/submission reads and participant prepare. Submission-list hash includes normalized `{page:1,limit:1,pageAll:false,status:null}` although null status is omitted from the URL. Each read requires a fresh message signature; no cached authentication/retries.

If a participant submit is ambiguous, explicitly authorized recovery uses `submissions.getIntent(taskId,intentId)` (GET; message `gibwork:view-task-submission-intent`, taskId/intentId/queryHash). Never pay again automatically. Creator create results can be `confirmed`, `processing` or `failed`; ambiguous creator submits require authoritative reconciliation, not re-creation. No fully general creator intent-status method is documented in this SDK.

**Payout is outside the validation test and requires separate approval:** `submissions.prepareApproval(taskId,submissionId,{amount:"1.00"})` requests message `gibwork:approve-task-submission-intent`; one `signPreparedTransaction`, then `submissions.submitApproval(taskId,submissionId,intentId,signedTransaction)`. If accepted, the real contributor must receive the promised reward through an explicitly authorized later payout. Docker PASS alone never authorizes it.

## Cancellation/refund

SDK provides no separate `tasks.cancel` method. It exposes `tasks.prepareRefund(taskId)` (POST `/v2/int/tasks/{taskId}/refund`; message `gibwork:refund-task-intent`), one transaction signature through `signPreparedTransaction`, and `tasks.submitRefund(taskId,intentId,signedTransaction)` (POST refund-intent submit; no extra message). Task summaries expose `canRefund`; refund quote reports gross amount, fee and net return.

These interfaces demonstrate refund support, **not guaranteed immediate/full recovery when nobody submits**. Eligibility, waiting period, refund rate, initial fee recovery, remaining escrow and account-rent recovery remain unconfirmed. Do not model a deadline as automatic cancellation; SDK README says deadline updates can be ignored for non-credit bounties below $5. Refund requires separate explicit human authorization. Once work is accepted/paid, paid funds cannot be assumed recoverable.

## PRE-FLIGHT SUMMARY

- **Exact token:** native Solana mainnet USDC; mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.
- **Bounty amount:** provisional **1.00 USDC**, one solution, `minSubmissionAmount:"1.00"`. This is a proposed low-cost test, NOT a verified service minimum. If rejected, stop rather than increase it automatically.
- **Estimated fees:** creator/refund/payout platform fees unknown. Participant SDK fee currently **0.15 USDC**, network sponsored. SOL baseline **0.000005 SOL per charged signature per broadcast**, plus unknown priority fees and account rent; creator sponsorship unknown.
- **Maximum wallet exposure:** exact executable maximum cannot yet be verified. Expected creator outflow is quoted creation `totalDebit` plus creator-paid SOL fees/rent, plus additional creator-paid fees/rent for an authorized payout OR refund. Payout from already funded escrow is not a second bounty deposit. Proposed future hard policy cap: **1.50 USDC total creator outflow plus 0.01 SOL total lifecycle outflow**, no other assets, no delegates/allowances, one funding transaction and at most one separately authorized payout/refund. These are arbitrary budget ceilings, not fee estimates, and were not implemented or approved at the original pre-flight. See SPENDING-GUARD.md for the subsequent non-signing cap/review implementation; funding remains disabled. If both parties are funded by the user, also budget participant 0.15 USDC: conditional combined cap **1.65 USDC + 0.01 SOL**, subject to the fee remaining 0.15 and the transaction checks. Without decoded instruction checks, caps are not guarantees; an opaque signature could authorize other wallet assets. Actual pre-flight outflow: **zero**.
- **Required wallet balance:** cannot be exact until limits, fee payer, quote and transaction are verified. Creator needs at least validated `paymentQuote.totalDebit` USDC plus any creator-paid fee/rent reserve. Do not fund now. Proposed cap is not a required balance. A participant separately needs an active eligible platform wallet and at least its quoted submission debit (documented 0.15 USDC).
- **Transactions/signatures:** happy path above: creator 3 messages/1 transaction, SDK participant 1 message/1 transaction; later payout OR refund adds creator 1 message/1 transaction. Recovery reads add messages only after separate authorization. None requested in this pre-flight.
- **Refund/cancellation:** quoted refund workflow exists, but timing, fees and eligibility are unresolved; no unconditional refund promise or automatic cancellation.
- **Title:** `ESCALATE integration test: fix the TypeScript retry policy`
- **Description:** the exact brief below, with public resource URLs and pinned baseline to be inserted and reviewed before publication.
- **Risks/unknowns:** minimum amounts; authoritative token allowlist and cluster; creator eligibility; exact fee/rent/priority charges; fee payer and sponsorship; refund conditions; participant app versus SDK charges; transaction instruction/program safety; SDK UNLICENSED metadata and previously reported moderate dependency advisories; public resource availability; low reward may not attract a participant. Public repo URL is currently absent from local Git remotes. A genuine live participant submission must not be fabricated to claim success.

## Exact bounty brief

**Title:** ESCALATE integration test: fix the TypeScript retry policy

**Description:**

This is a small, real ESCALATE integration-test bounty using a deliberately buggy TypeScript fixture. An AI coding agent recorded three failed attempts; we need one human solution to demonstrate safe handoff and isolated validation.

The fixture's `shouldRetry(status)` currently retries every status at or above 400. Correct it to retry only HTTP 429 and the inclusive range 500–599. Other client errors, successful responses, redirects and status 600 must not be retried.

Resources: the creator will supply a publicly accessible, secret-redacted repository snapshot, its exact Git baseline SHA, failed-attempt summary, existing tests and reproduction instructions before this bounty is published. Do not use a local filesystem path as a resource link.

Deliver one minimal unified Git patch against that pinned baseline, a public pull-request or commit URL, the patch SHA-256, and a short explanation of the fix and test results. Include those links, baseline and digest in your Gibwork submission so the creator can associate the exact downloaded patch with your submission. Make no dependency, test, configuration or unrelated-file changes; change only `src/retry.ts` in the supplied fixture.

Acceptance: the unchanged TypeScript compiler and tests must pass in ESCALATE's Docker validator; 429, 500, 502, 503 and 599 are retryable; 200, 301, 400, 401, 403, 404, 499 and 600 are not. The creator will inspect patch/test integrity and verify its digest before execution. No network access or wallet material is available inside validation. PASS is advisory and requires human review.

Proposed reward: 1.00 USDC gross from the reward pool for one accepted solution, subject to platform payout deductions confirmed before publication. Participant submission fees may apply (SDK currently documents 0.15 USDC); inspect Gibwork's fee display before paying. Do not pay repeatedly after an ambiguous submission result. No automatic approval, merge or payout is promised. This test uses no guaranteed deadline or automatic cancellation; the creator will coordinate timing before publication.

## Remaining work — funding path stays disabled

1. Publish an accessible immutable fixture/context bundle and review exact links, baseline, redaction and reward terms; do not publish private code.
2. Obtain official service confirmation of minimums, fees, cluster and refund rules without a prepare mutation. There is no documented read-only quote endpoint in installed 0.2.0. If a quote requires prepare, request narrowly scoped explicit authorization for that mutation first; no signing/funding implied.
3. The non-signing guard now decodes a limited instruction set, checks cumulative caps, and reads independent account/fee data. Any future funding path still requires exact-action human approval, supported escrow effects, complete rent/lookup-table verification and ambiguity recovery. Unsupported effects remain blocked. Current Phantom bridge only signs the allowlisted read message; `signTransaction` still throws. Do not generalize it to arbitrary messages or transactions.
4. Add a guarded read-only live `submissions.list` transport for the funded task and bind retrieved submission content to the maintainer-downloaded patch digest. Current `escalate review` transport remains offline; Docker validation can already accept a maintained local patch. No participant-link download or candidate code execution on the host.
5. Obtain separate explicit approvals for prepare, actual funding and any later payout/refund based on concrete reviewed quotes/transactions. Do not proceed on a blanket approval with unknown exposure.

**STOP:** no transaction or task creation is authorized by this pre-flight. Further actions wait for the user's explicit approval; write/monetary capabilities remain disabled.

## Subsequent spending-guard implementation

See [SPENDING-GUARD.md](SPENDING-GUARD.md). The non-signing review now enforces fixed 1.50 USDC / 0.01 SOL cumulative local-policy caps, maintains a durable reservation ledger and rejects independently unverifiable effects. No transaction signature path was added. `prepareCreate` remains uncalled because the service does not document absence of external intent obligations; exact live quote and acceptance of the proposed minimum remain unverified.
