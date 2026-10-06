# Creator spending guard — pre-flight only

No prepare, transaction-signing, submission or funding operation was performed. Checkpoint `8a654a5` remains intact. No Phantom transaction-signature path exists. Every review reports `signingAllowed:false`, including a successfully verified review.

## Enforced limits

`src/security/spending.ts` uses integer base units: maximum **1,500,000 USDC units (1.50 USDC)** and **10,000,000 lamports (0.01 SOL)**. The proposed funding reward must be exactly 1,000,000 USDC units, and quoted total must equal funding plus platform fee. Other mints/decimals, imprecise values, negative prior debits and quotes above remaining cumulative budget fail closed.

A quote is insufficient. The exact serialized transaction is canonically decoded and hashed. Unsigned legacy/v0 transactions only; one creator signer/fee payer; no unresolved address lookup tables, additional signatures or unexpected writable accounts. Independently approved destinations are required (not copied automatically from a service response).

The limited verifier understands only legacy SPL Token TransferChecked for native USDC and plain System transfers. Source ownership, mint, token-account state and network fee must be independently read from pinned mainnet RPC. SOL bound includes every decoded SOL transfer and the RPC network fee. Token bound sums gross outward transfers, never subtracting incoming funds or potential refunds. Cumulative prior debits consume the budget.

Unknown/custom escrow programs, CPI effects, account/rent creation, Token-2022 extensions, delegation, closes, compute-budget instructions, unsupported signers and lookup tables are rejected. An actual Gibwork escrow transaction will remain BLOCKED unless its effects fit this narrow supported set; decoding its opaque bytes or simulating it once cannot establish a safe bound. No claim is made that an actual escrow has been verified.

The RPC implementation permits only `getGenesisHash`, `getFeeForMessage`, and `getAccountInfo` against the fixed mainnet-beta HTTPS endpoint, with redirects and rate-limit retries disabled. RPC calls happen only when explicitly requested. Missing/expired fee information, wrong cluster/mint or unsupported account data block review. This is independent of the prepare API but still trusts the selected RPC; it is not cryptographic state-proof verification. RPC/account observations are point-in-time; any future signing gate must revalidate fresh state and the exact bytes.

## Inspect an existing local artifact

```sh
npm run inspect:prepared -- --file prepared-review.json
# Separately and explicitly permit read-only mainnet RPC calls:
npm run inspect:prepared -- --file prepared-review.json --rpc
```

Input requires `serializedTransaction`, exact SDK `quote` (`paymentQuote`), `creator` public address, independently verified `approvedRecipients`. It accepts no secrets. Without `--rpc`, independent verification is unavailable and review fails closed. Output includes the quote, transaction digest, exact programs/account lists/raw instruction data, decoded transfers and a maximum debit ONLY if the whole verification succeeds. Creator identity is masked in terminal output. A partial transfer list is not a verified bound. Successful review atomically records a local policy reservation in `.escalate/creator-budget` before emitting the report. This is not an on-chain funds reservation. Nothing is automatically downloaded from participant links.

This command is a non-signing review tool, not a funding command. Prior debits are loaded from the per-creator durable local ledger, not the review artifact. An exclusive lock and atomic fsynced writes prevent concurrent over-reservation; duplicate digests are rejected and no automatic release/reset is provided. Corrupt/exhausted ledgers and uncertain pending writes fail closed. An interrupted session may require manual reconciliation; deleting or editing the ledger bypasses the policy and is outside the trusted-local-checkout boundary. Any future transaction path must use this same reservation gate, revalidate effects, preserve ambiguous reservations, and require separate exact-action human approval. Because no transaction can currently be signed/submitted through ESCALATE, actual wallet exposure remains zero. Do not interpret these local modules as authorization to call the SDK's automatic signing convenience methods.

## Why prepareCreate was not called

SDK 0.2.0 `tasks.prepareCreate` signs `gibwork:create-task-intent`, then POSTs `/v2/int/tasks`. It returns an intentId, taskId, serializedTransaction and paymentQuote. Official SDK/docs do not establish that intent preparation avoids a task reservation, externally visible obligation or other service-side effect. Non-signing does not mean non-mutating.

The user's authorization is conditional on absence of publication, reservation, fees and external obligations. That condition remains unverified, so **no POST or wallet message approval was requested**. Acceptance of 1.00 USDC reward/minimum, exact platform fees, transfers, recipient/program identity, rent and fee payer remain unknown. Obtain authoritative documented service guarantees first, or explicit narrowly scoped authorization acknowledging the potential intent mutation; neither implies transaction approval.

Future transactions must remain blocked until a complete exact quote/effects report is shown and the user separately approves. Passing review still never triggers Phantom here.

Sources: installed official SDK 0.2.0 README/types/implementation; https://docs.gib.work/getting-started/create-your-first-bounty.md ; https://solana.com/docs/rpc/http/getfeeformessage ; https://solana.com/docs/core/instructions .
