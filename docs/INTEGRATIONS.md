# Integrations

PriceGuard Covenant V2 exposes canonical JSON views for BTC/USD market evidence, covenant state, attestations, retained discovery indexes, and protocol counters. Integrators should bind every read to the exact network and contract and validate the complete response shape before acting.

## Network and contract identity

| Field | Required value |
| --- | --- |
| Network | GenLayer Bradbury Testnet |
| Chain ID | `4221` (`0x107d`) |
| RPC | `https://rpc-bradbury.genlayer.com` |
| Contract | `0x7B939483E69ada6d2ca37acd3684182Ed141F35F` |
| Protocol version | `priceguard-covenant-1` |
| Policy version | `BTCUSD-1` |
| Symbol | `BTC/USD` |
| Asset class | `CRYPTO_SPOT` |
| Price decimals | `2` |

Reject data from another chain, address, protocol version, policy version, or symbol even if its JSON shape is similar.

## Public views

These are the exact view signatures defined by `contracts/priceguard.py`. Every method returns a canonical JSON `str`.

| Signature | Response |
| --- | --- |
| `get_market(symbol: str) -> str` | Found/not-found market result |
| `get_market_history(symbol: str, offset: int, limit: int) -> str` | Newest-first retained market page |
| `get_supported_markets() -> str` | Array containing the one supported market |
| `get_covenant(covenant_id: str) -> str` | Found/not-found covenant result |
| `get_covenants_by_creator(owner: str, offset: int, limit: int) -> str` | Creator-index covenant page |
| `get_covenants_by_counterparty(owner: str, offset: int, limit: int) -> str` | Counterparty-index covenant page |
| `get_covenant_evaluations(covenant_id: str, offset: int, limit: int) -> str` | Newest-first retained attestation page for one covenant |
| `get_attestation(attestation_id: str) -> str` | Found/not-found attestation result |
| `get_attestations(offset: int, limit: int) -> str` | Newest-first global retained attestation page |
| `get_protocol_stats() -> str` | Protocol identity and decimal-string counters |

`symbol` is normalized by the market views but must resolve to `BTC/USD`. Owner addresses must be nonzero 20-byte hexadecimal addresses. `offset` must be nonnegative, and `limit` must be between `0` and `50`, inclusive. `get_covenant_evaluations` requires an existing covenant.

## Typed response expectations

The SDK may expose the return as a JSON string or an already-decoded value. Parse a string once, then require exact keys and types. Do not coerce malformed values into the expected type.

### Market

`get_market` returns exactly one of:

```ts
type MarketNotFound = { found: false; symbol: 'BTC/USD' }

type MarketFound = {
  found: true
  symbol: 'BTC/USD'
  asset_class: 'CRYPTO_SPOT'
  decimals: 2
  policy_version: 'BTCUSD-1'
  observations: Array<{
    source: 'bitstamp' | 'coinbase' | 'gemini'
    price: string
    observed_at: string
  }>
  valid_source_count: number
  rejected_source_count: number
  median_price: string
  minimum_observation: string
  maximum_observation: string
  spread_bps: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  circuit_breaker: boolean
  transaction_epoch: string
  update_sequence: string
  updater: string
}
```

All string-number fields are canonical unsigned base-10 integers. Prices are integer cents. Stored observations are sorted by source name (`bitstamp`, `coinbase`, `gemini` for a complete snapshot). Stored snapshots have two or three unique accepted sources, no circuit breaker, and source counts totaling three when rejected sources are included.

`get_market_history` returns `{ items, offset, limit, total }`; each item has the market fields above without `found`. `total` is the number currently retained and never exceeds `32`, not the number of all updates ever executed. Use `get_protocol_stats().market_update_count` for the total-ever update counter.

`get_supported_markets` returns exactly:

```json
[
  {
    "asset_class": "CRYPTO_SPOT",
    "decimals": 2,
    "policy_version": "BTCUSD-1",
    "sources": ["coinbase", "bitstamp", "gemini"],
    "symbol": "BTC/USD"
  }
]
```

### Covenant

`get_covenant` returns `{ "found": false, "covenant_id": "..." }` or `found: true` plus exactly these fields:

| Field | Type |
| --- | --- |
| `covenant_id`, `client_request_id`, `mode` | string |
| `creator`, `counterparty`, `symbol`, `condition_type` | string |
| `threshold_low`, `threshold_high` | canonical decimal-integer strings |
| `decimals` | integer `2` |
| `valid_from`, `expiry` | canonical epoch-second strings |
| `minimum_confidence` | string `HIGH` |
| `maximum_spread_bps` | integer from `0` through `100` |
| `status` | `PENDING_ACCEPTANCE`, `ACTIVE`, `TRIGGERED`, `EXPIRED`, `CANCELED`, or `CLOSED` |
| `accepted_at`, `last_evaluated_at`, `evaluation_count` | canonical decimal-integer strings |
| `trigger_snapshot_sequence`, `triggered_at`, `closed_at` | canonical decimal-integer strings |
| `trigger_attestation_id` | empty string or canonical attestation ID |
| `creator_acknowledged`, `counterparty_acknowledged` | boolean |
| `memo`, `external_reference_hash`, `revision_of` | string |
| `policy_version` | string `BTCUSD-1` |

Creator and counterparty pages return `{ items, offset, limit, total }`. Items are complete covenant objects without `found`. Index order is creation order. A bilateral covenant appears in its creator's index and its named counterparty's index; a PERSONAL covenant has the zero address as counterparty and is not added to a counterparty index.

### Attestation

`get_attestation` returns `{ "found": false, "attestation_id": "..." }` or `found: true` plus the exact schema documented in [Attestation schema](ATTESTATION_SCHEMA.md). `evaluation_sequence`, `decimals`, `valid_source_count`, and `spread_bps` are JSON numbers. Price, threshold, snapshot-sequence, and timestamp values are canonical decimal-integer strings.

Both attestation list views return `{ items, offset, limit, total, retained }`. Items are complete attestation objects without `found`. `total` is the total number ever created for that scope, while `retained` is the number discoverable through that circular index.

### Protocol statistics

`get_protocol_stats` returns exactly:

```ts
type ProtocolStats = {
  protocol_version: 'priceguard-covenant-1'
  policy_version: 'BTCUSD-1'
  market_update_count: string
  covenant_count: string
  personal_count: string
  bilateral_count: string
  pending_count: string
  active_count: string
  triggered_count: string
  expired_count: string
  canceled_count: string
  closed_count: string
  attestation_count: string
  custody: false
}
```

Every counter is a canonical unsigned decimal string. Covenant state counters sum to `covenant_count`; PERSONAL plus BILATERAL counts also sum to `covenant_count` when read from one coherent state.

## Safe illustrative read

This example is illustrative and performs no write. Production integrations should add exact runtime validation equivalent to `lib/types.ts`.

```ts
import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

const address = '0x7B939483E69ada6d2ca37acd3684182Ed141F35F'
const client = createClient({ chain: testnetBradbury })

const raw = await client.readContract({
  address,
  functionName: 'get_attestation',
  // Illustrative deterministic test-vector ID; not claimed as a live record.
  args: ['att_7dc34349aa4584a816a4a0a5453b8737c9357130da5b9d38'],
})

const result: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
// Require the exact schema before using result. Never infer payment from outcome.
```

For an exact covenant read, use `get_covenant` with a `cov_` ID followed by 48 lowercase hexadecimal characters. Do not call `client.connect()` for a public read.

## Attestation verification checklist

Before relying on an attestation:

1. Confirm Bradbury chain `4221` and the active contract address.
2. Require `found: true`, the exact field set, and schema version `priceguard-attestation-1`.
3. Require canonical `att_` and `cov_` IDs and persist both.
4. Recompute `attestation_id` as `att_` plus the first 48 lowercase hexadecimal characters of SHA-256 over `covenant_id + ":" + decimal evaluation_sequence`.
5. Read the exact covenant and require matching condition, thresholds, decimals, symbol, policy version, and a positive evaluation sequence no greater than its current `evaluation_count`.
6. Require three source identities in contract order: `coinbase`, `bitstamp`, `gemini`.
7. Require `valid_source_count: 3`, `confidence: HIGH`, `circuit_breaker: false`, and spread at or below both 100 basis points and the covenant's cap.
8. Recompute the condition outcome from `evaluated_price`, `threshold_low`, and `threshold_high` using integer arithmetic and the contract's strict/inclusive operators.
9. Require canonical epoch seconds and a valid evaluator address.
10. If the referenced market snapshot is still retained, correlate `snapshot_sequence` and summary fields. If it is no longer retained, do not claim the individual observations were independently reconstructed from the attestation alone.
11. Define replay, duplicate-processing, policy-version, and consequence rules in the consuming system.

## Covenant verification checklist

1. Bind the read to chain `4221` and the active contract address.
2. Require `found: true`, the exact covenant field set, and policy `BTCUSD-1`.
3. Recompute the deterministic covenant ID as `cov_` plus the first 48 lowercase hexadecimal characters of SHA-256 over `lowercase creator + ":" + client_request_id`.
4. Validate creator and counterparty addresses. PERSONAL requires the zero address; BILATERAL requires a distinct nonzero counterparty.
5. Require symbol `BTC/USD`, decimals `2`, a supported condition, canonical positive `threshold_low`, and correct `threshold_high` handling.
6. Validate `valid_from <= expiry`, `minimum_confidence: HIGH`, and a `maximum_spread_bps` from 0 through 100. The contract enforces a future expiry no more than 365 days from creation, but the covenant record has no creation timestamp, so that historical creation-time check cannot be reconstructed from this view alone.
7. Validate the current status together with its lifecycle timestamps, acknowledgement flags, trigger snapshot, and trigger attestation ID. Do not treat one field in isolation as proof of a transition.
8. Read and verify the trigger attestation when the covenant is `TRIGGERED` or `CLOSED` due to a satisfied evaluation.
9. Treat memo, external reference, and revision references as user-authored metadata, not trusted external facts.

## Transaction finality requirements

For writes, a transaction is successful only when the GenLayer transaction reports `FINALIZED` and `FINISHED_WITH_RETURN`. `ACCEPTED` and `READY_TO_FINALIZE` are not final. A result label such as `AGREE` or `MAJORITY_AGREE` does not replace the final status and execution-result checks.

After finalization, perform the relevant state read and retain the transaction hash, returned record ID when available, and observed state. A state read is supplementary evidence and may reflect a later valid transaction. Never automatically resubmit an unknown or delayed transaction.

## Retention and discoverability

- Latest market history: newest `32` snapshots; no exact-by-sequence market view exists.
- Per-covenant evaluation discovery: newest `32` attestation IDs.
- Global attestation discovery: newest `256` attestation IDs.
- Exact covenant and attestation records: remain addressable by exact ID.
- Creator and counterparty indexes: grow without an artificial record cap.
- Maximum page size: `50`.

Retained circular indexes overwrite old discovery slots, not exact attestation records. Persist exact covenant IDs, attestation IDs, transaction hashes, contract address, chain ID, policy version, and the time your integration observed them.

## Pagination guidance

Page until `offset + items.length >= total` for creator and counterparty indexes. Keep independent offsets when merging those two indexes because one may be exhausted before the other.

For `get_attestations` and `get_covenant_evaluations`, page only while `offset + items.length < retained`; `total` may be much larger than what remains discoverable. For market history, `total` is already the retained count. A zero `limit` is valid and returns no items.

## Non-custodial boundary

PriceGuard does not receive, hold, transfer, settle, refund, or release funds. `outcome: SATISFIED`, `status: TRIGGERED`, and `status: CLOSED` are evidence states only. They are not payment receipts, custody guarantees, legal judgments, or instructions automatically executed by the contract.

An integration that moves assets does so under its own code, authorization, custody model, and risk controls.

## Failure handling

- Fail closed on malformed JSON, extra or missing fields, type mismatches, invalid IDs, unsupported enum values, inconsistent counts, or wrong network identity.
- Distinguish not-found responses from RPC errors and malformed responses.
- Treat retained-index omission as “not discoverable through this index,” not proof that an exact record never existed.
- Back off on RPC or venue availability errors and preserve the last verified record separately from transient failures.
- Do not use the frontend's current API preview as contract evidence.
- Do not retry writes automatically after an unknown status or missing response.
- Log only bounded, non-sensitive diagnostics; never store private keys, seed phrases, signatures, bearer tokens, or raw signed transactions.
- Re-review integrations whenever the accepted contract address, schema version, or policy version changes.
