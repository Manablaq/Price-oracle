# Attestation schema

Every successful covenant evaluation writes one exact JSON attestation with schema version `priceguard-attestation-1`. The record is market-condition evidence produced at the contract consensus boundary.

## Exact fields

| Field | JSON type | Meaning |
| --- | --- | --- |
| `schema_version` | string | Exact value `priceguard-attestation-1`. |
| `attestation_id` | string | Deterministic `att_` ID followed by 48 lowercase hexadecimal characters. |
| `covenant_id` | string | Exact covenant evaluated. |
| `evaluation_sequence` | number | One-based evaluation number for that covenant. |
| `outcome` | string | `SATISFIED` or `NOT_SATISFIED`. |
| `symbol` | string | Exact value `BTC/USD`. |
| `condition_type` | string | `ABOVE`, `BELOW`, `AT_OR_ABOVE`, `AT_OR_BELOW`, or `IN_RANGE`. |
| `threshold_low` | string | Canonical unsigned integer cents; always positive. |
| `threshold_high` | string | Canonical unsigned integer cents for `IN_RANGE`; otherwise `0`. |
| `evaluated_price` | string | Canonical unsigned integer cents from the market median. |
| `decimals` | number | Exact value `2`. |
| `snapshot_sequence` | string | Canonical positive integer identifying the stored market snapshot sequence. |
| `valid_source_count` | number | Exact value `3` for covenant evaluations. |
| `source_identities` | array of strings | Exact order `coinbase`, `bitstamp`, `gemini`. |
| `minimum_observation` | string | Lowest accepted source price in integer cents. |
| `maximum_observation` | string | Highest accepted source price in integer cents. |
| `spread_bps` | number | Integer source spread in basis points. |
| `confidence` | string | Exact value `HIGH` for a successful covenant evaluation. |
| `circuit_breaker` | boolean | Exact value `false` for a stored attestation. |
| `policy_version` | string | Exact value `BTCUSD-1`. |
| `evaluated_at` | string | Canonical positive Unix epoch seconds from contract execution time. |
| `evaluator` | string | Address that submitted `evaluate_covenant`. |

`get_attestation` adds `found: true` to a found record. The stored record and list-page items do not contain `found`. A missing exact ID returns only `found: false` and the requested `attestation_id`.

## Canonical scaling and arithmetic

- All market and threshold values use two decimals and are stored as unsigned base-10 integer strings. `7000012` represents `70,000.12 USD`.
- Source decimal text permits at most 12 whole digits and eight fractional digits. It is converted to cents with deterministic half-up rounding at the third fractional digit. Binary floating-point is not used.
- Covenant thresholds permit at most 12 whole digits and two fractional digits. They are scaled exactly to cents; extra fractional precision is rejected rather than rounded.
- Canonical integer strings have digits only and no sign, exponent, whitespace, decimal point, or nonessential leading zeros.
- `spread_bps` is `floor(abs(maximum - minimum) * 10,000 / minimum)` using integer arithmetic.
- Outcome comparison uses scaled integers: strict `>` or `<`, inclusive `>=` or `<=`, or an inclusive range.

## Source summary

The attestation commits to the three fixed source identities, valid-source count, minimum and maximum accepted observations, spread, confidence, circuit-breaker state, evaluated median, and market snapshot sequence. It does not repeat every accepted source observation.

When the corresponding market snapshot remains in the 32-entry market-history ring, an integrator can correlate its sequence and summary. After that snapshot leaves the retained market index, the attestation alone is not enough to reconstruct each individual venue observation. Do not claim more source-level evidence than the retained data supports.

## Confidence and circuit breaker

For the general market policy:

- `HIGH` requires all three accepted sources and spread at most 25 basis points.
- `MEDIUM` requires spread at most 75 basis points when the HIGH rule is not met.
- `LOW` applies above 75 basis points while still within the storage breaker.
- The circuit breaker is true only when spread exceeds 100 basis points.

Covenant evaluation is stricter than a manual market refresh. It requires all three sources, `HIGH` confidence, no circuit breaker, and spread no greater than the covenant's own `maximum_spread_bps`. Therefore every stored attestation has source count `3`, confidence `HIGH`, and breaker `false`.

## Deterministic ID

The attestation ID is:

```text
att_ + first_48_lowercase_hex(
  SHA-256(ASCII(covenant_id + ":" + decimal_evaluation_sequence))
)
```

The sequence is written in ordinary base-10 form without padding. Integrators should recompute the ID before trusting a record.

## Retention and discoverability

Exact attestation records are stored by ID and are not deleted by the contract. Discoverability is bounded:

- the global circular index exposes the newest 256 attestation IDs;
- each covenant's circular evaluation index exposes its newest 32 attestation IDs; and
- each public page accepts at most 50 items.

The list responses report both `total` ever created and `retained` currently discoverable. An old attestation can remain readable through `get_attestation(exact_id)` after it disappears from both retained indexes. Persist exact IDs and transaction hashes that matter to an integration.

## Illustrative JSON

The following is structurally valid illustrative data only. It is not claimed as a live Bradbury record or lifecycle evidence.

```json
{
  "attestation_id": "att_7dc34349aa4584a816a4a0a5453b8737c9357130da5b9d38",
  "circuit_breaker": false,
  "condition_type": "BELOW",
  "confidence": "HIGH",
  "covenant_id": "cov_80d9a51572fbeee1771904f4f12bd9b8979d797db9d5cd0a",
  "decimals": 2,
  "evaluated_at": "1783944100",
  "evaluated_price": "7100000",
  "evaluation_sequence": 1,
  "evaluator": "0x2222222222222222222222222222222222222222",
  "maximum_observation": "7100100",
  "minimum_observation": "7099900",
  "outcome": "NOT_SATISFIED",
  "policy_version": "BTCUSD-1",
  "schema_version": "priceguard-attestation-1",
  "snapshot_sequence": "2",
  "source_identities": [
    "coinbase",
    "bitstamp",
    "gemini"
  ],
  "spread_bps": 2,
  "symbol": "BTC/USD",
  "threshold_high": "0",
  "threshold_low": "7000000",
  "valid_source_count": 3
}
```

## Integrator verification checklist

1. Bind the read to Bradbury chain `4221` and the active PriceGuard V2 contract.
2. Require `found: true` and exactly the fields and JSON types above.
3. Reject unknown schema, policy, symbol, decimals, source order, confidence, breaker, outcome, or condition values.
4. Recompute the deterministic attestation ID from covenant ID and evaluation sequence.
5. Read the exact covenant and require matching symbol, policy, condition, thresholds, and decimals.
6. Recompute `outcome` from integer `evaluated_price` and covenant thresholds.
7. Require three sources, `HIGH`, breaker `false`, and spread within both protocol and covenant caps.
8. Validate all canonical numeric strings, evaluator address, and positive epoch/sequence values.
9. Correlate retained market snapshot data when available and state clearly when it is not.
10. Apply independent replay protection, duplicate handling, authorization, and consequence rules.

## Non-custodial disclaimer

An attestation is evidence only. It is not a payment receipt, proof of custody, transfer authorization, settlement instruction, legal judgment, or guarantee that an external system acted. PriceGuard V2 accepts and transfers no funds. Any downstream asset movement is outside this contract and remains the integrator's responsibility.
