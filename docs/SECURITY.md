# Security model

PriceGuard Covenant V2 reduces single-response trust for a narrow BTC/USD policy. It does not eliminate external-data, validator, network, frontend, wallet, contract, or integration risk. Bradbury is a test network, and the complete covenant lifecycle remains unverified.

## Non-custodial boundary

`contracts/priceguard.py` accepts no GEN and has no payable decorator, `gl.message.value` read, balance ledger, transfer, claim, refund, settlement, administrator withdrawal, or outbound contract message. A covenant and its attestations are evidence records, not payment instructions, asset custody, or legal enforcement.

The wallet pays network fees directly when approving a write. PriceGuard does not request a GEN amount in contract arguments and every frontend `writeContract` call uses `value: 0n`.

## External-data consensus

- Symbol `BTC/USD`, policy `BTCUSD-1`, and the three venue endpoints are fixed in contract code.
- Coinbase Exchange, Bitstamp, and Gemini responses use source-specific parsing.
- Every configured source appears exactly once in the leader raw payload, including explicit failure records.
- Observations are freshness-checked and normalized to bounded integer cents.
- Validators require the exact leader schema and independently recompute every derived field.
- Validators independently fetch and normalize the same fixed sources.
- Leader and validator medians must remain within 50 basis points.
- Manual refresh requires at least two accepted sources and no breaker.
- Covenant evaluation requires all three sources, `HIGH` confidence, no breaker, and the covenant's spread cap.
- Contract storage changes only after the nondeterministic consensus call returns.

These controls reduce reliance on one response. They do not prove venue independence or eliminate manipulation, abnormal last trades, correlated markets, shared hosting/network infrastructure, API shape changes, rate limits, outages, timing differences, validator collusion or failure, consensus bugs, or policy error.

## Fixed-point and schema safety

Consensus-critical market arithmetic uses bounded integers. Source prices accept plain unsigned decimal text and deterministically round to cents using half-up integer logic. Covenant thresholds permit at most two fractional digits and reject extra precision. Exponent notation, signs, noncanonical timestamps, duplicate sources, invalid addresses, and out-of-bound values fail assertions.

The contract serializes canonical compact JSON. Validators require exact leader keys. Frontend runtime guards require exact stored-response keys and types and reject extra or missing fields. These controls reduce shape-confusion risk but do not replace contract-source review.

## Authorization and time

- The sender becomes creator at covenant creation.
- PERSONAL requires the zero-address counterparty and starts `ACTIVE`.
- BILATERAL requires a distinct nonzero counterparty and starts `PENDING_ACCEPTANCE`.
- Only the named counterparty accepts, on or before expiry.
- Only the creator cancels an unaccepted bilateral covenant, on or before expiry.
- Anyone may evaluate `ACTIVE` state during `valid_from <= now <= expiry`.
- Anyone may explicitly expire pending or active state only after expiry.
- Only named parties acknowledge `TRIGGERED`; duplicate acknowledgement fails.
- PERSONAL closes after creator acknowledgement; BILATERAL closes after both named parties acknowledge.

Open evaluation and expiry are intentional because those operations apply fixed contract rules. They do not authorize the caller to change terms or move assets.

## Deterministic identity and metadata

Covenant IDs bind lowercase creator address and client request ID. Attestation IDs bind covenant ID and one-based evaluation sequence. Shared test vectors protect cross-language parity.

Memo, external reference, and revision fields are user-authored. A lowercase 32-byte external-reference hash proves only that a value was supplied in the accepted format; the contract does not resolve or authenticate an external document. A revision link proves only that the referenced covenant existed and had the same creator at creation time.

## Storage and denial-of-service considerations

Every public page is bounded to 50 items. Market history and each covenant's evaluation-discovery index retain 32 entries; the global attestation-discovery index retains 256 IDs. Exact covenant and attestation records remain addressable, and total exact storage grows over time.

Creator and counterparty indexes grow without an artificial per-address cap. Integrators must paginate and should expect long-lived addresses to accumulate records. Bounded discovery means absence from an index is not proof that an exact attestation never existed.

## Wallet and network safety

The frontend supports injected EIP-1193 wallets only. EIP-6963 provider UUIDs bind the user's visible selection to the exact provider used for connection and writes. The legacy `window.ethereum` object is only a fallback. The application does not inspect `window.ethereum.providers`, include WalletConnect, request private keys, or invoke MetaMask Snap RPC methods.

Bradbury switching is explicit. `wallet_addEthereumChain` is attempted only after `wallet_switchEthereumChain` returns code `4902`, then the application switches again and verifies chain `4221`. Immediately before writing, it re-reads `eth_chainId` and `eth_accounts` and aborts if the chain or account changed.

App-session disconnect persists locally and blocks automatic account hydration until explicit reconnect. It does not revoke the site's extension authorization. Wallet authorization remains under the wallet's own permissions UI.

## Submission diagnostics and sensitive data

Writes are divided into preparation, client initialization, network verification, wallet submission, and hash validation. Unknown errors are reduced to bounded safe message/code fields; stack lines, bearer tokens, private keys, seed phrases, signatures, and long hexadecimal payloads are redacted. Raw provider objects and request payloads are not serialized for display.

Only a valid 32-byte hexadecimal transaction hash creates Activity. A missing, wrapped, malformed, or non-hexadecimal returned value is a submission failure and is not persisted as a transaction.

## Finality and post-state semantics

The frontend treats `ACCEPTED` and `READY_TO_FINALIZE` as nonterminal. Protocol success requires `FINALIZED` with `FINISHED_WITH_RETURN`. `AGREE` or `MAJORITY_AGREE` may be diagnostic result labels but are not substitute success gates. Canceled, timed-out, undetermined, no-majority, disagreement, and execution-error outcomes remain distinct failures.

Activity polling does not automatically resubmit. This prevents a delayed transaction from being duplicated after an ambiguous client or RPC result.

After confirmed finalization, a supplementary state read checks the expected record. It can detect unavailable, malformed, missing, or currently mismatched state but cannot revoke protocol finality or prove no later valid transaction changed the record.

## Browser-local Activity

Activity is validated local-browser data namespaced by chain, contract, and wallet. It is not an on-chain index and can be cleared, unavailable, or corrupted. Cross-tab merging selects the latest update for each hash. Retain important transaction hashes and verify them through Bradbury transaction data and contract reads.

## Integration boundary

Integrators must independently define:

- accepted chain, contract, schema, and policy versions;
- exact response validation and ID recomputation;
- authorization and signer controls;
- replay and duplicate-event protection;
- retained-index and exact-ID persistence strategy;
- consequences of `SATISFIED`, `TRIGGERED`, acknowledgements, and failures;
- RPC retry, backoff, monitoring, and incident response; and
- any custody, payment, legal, or operational controls outside PriceGuard.

An external system that moves assets based on PriceGuard evidence creates a separate risk and custody boundary. The PriceGuard contract does not execute or secure that downstream action.

## Production dependency advisory

Review date: 2026-07-13.

`npm audit --omit=dev` reports two moderate vulnerability entries (`next` and its transitive `postcss`) for [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) through `next@16.2.9 > postcss@8.4.31`. The separate `@tailwindcss/postcss@4.3.1 > postcss@8.5.15` path is not affected. The advisory affects PostCSS versions below 8.5.10 and concerns unescaped `</style>` during CSS stringification.

No supported nonbreaking remediation was available on the review date. Official npm metadata identified Next.js 16.2.10 as the latest stable release, and its package metadata still pins PostCSS 8.4.31. npm's automated suggestion to install Next.js 9.3.3 is a major downgrade to an obsolete line, so `npm audit fix --force` was rejected. A canary release or an unvalidated transitive override is not an acceptable production remediation. Reassess the required audit output when Next.js publishes a supported stable release containing PostCSS 8.5.10 or newer.

The dependency audit remains a required review command, but its currently documented moderate findings mean a nonzero exit is expected and must not be represented as a clean or passing audit. CI surfaces the audit as a review step with `continue-on-error` and does not use it as a zero-finding release gate.

## Deployment assurance

The active V2 address is `0x7B939483E69ada6d2ca37acd3684182Ed141F35F`. Its supplied source SHA-256 is `bdd0fac72f9659d76e03c04c60d55f1be4a46127da691fa9265cc77bd10b125a`, from deployment source commit `645e49a73e32cc0fdb12fda459d0fc7fa3b4d8f9`. The deployment identity is recorded. The supplied first-market-refresh reference does not have preserved finality, execution-result, record-ID, state-read, or identifier-type proof. Complete lifecycle evidence is not preserved.

Review [Bradbury deployment](BRADBURY_DEPLOYMENT.md) and [Testing](TESTING.md) before making additional verification claims. Do not infer production readiness from testnet operation.

## Reporting

Do not include private keys, seed phrases, wallet exports, bearer tokens, signatures, or raw signed transactions in a report. Provide the affected commit, contract address, chain ID, transaction hash when safe, reproduction conditions, expected/actual behavior, and a minimal redacted diagnostic. Coordinate disclosure with the repository owner before publishing an exploitable issue.
