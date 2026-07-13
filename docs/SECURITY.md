# Security model

## Non-custodial boundary

`contracts/priceguard.py` accepts no GEN and has no payable decorator,
`gl.message.value`, balance, transfer, claim, refund, administrator withdrawal,
or external message. A covenant and its attestations are evidence records, not
payment instructions or legal enforcement.

## External-data consensus

- The symbol and three source endpoints are fixed in contract code.
- Leader and validators parse source-specific response shapes.
- Every configured source is represented exactly once, including explicit
  failures.
- Observations are freshness-checked and normalized to integer cents.
- Validators recompute every derived leader field and independently fetch all
  sources again.
- Leader/validator medians must be within 50 bps.
- Market refresh needs at least two accepted sources; covenant evaluation is
  stricter and requires all three sources, HIGH confidence, no breaker, and the
  covenant spread cap.
- Storage is written only after `run_nondet_unsafe` returns consensus output.

These controls reduce single-response trust but do not eliminate exchange
manipulation, correlated venues, shared infrastructure, network failure,
front-running, validator failure, or policy error.

## Fixed-point and schema safety

Consensus arithmetic uses bounded integers. Source decimals may have up to
eight fractional digits and are deterministically rounded to cents. Covenant
thresholds allow at most two fractional digits and are stored as canonical
integer cents. Canonical compact JSON and exact response schemas prevent
shape-only acceptance in the V2 validator and frontend.

## Authorization and time

- PERSONAL covenants use the zero-address counterparty and start ACTIVE.
- BILATERAL covenants require a distinct non-zero counterparty and start
  PENDING_ACCEPTANCE.
- Only the named counterparty accepts.
- Only the creator cancels before acceptance.
- Evaluation is available only during `valid_from <= now <= expiry`.
- Expiry is available only after expiry.
- Only named parties acknowledge a TRIGGERED result; duplicate
  acknowledgement fails.

## Storage and denial-of-service considerations

All public views are bounded to 50 items. Market and per-covenant histories use
32-entry retained rings, and the global attestation discovery index retains 256
IDs. Exact records remain addressable and total storage grows over time. Creator
and counterparty indexes are not artificially capped, so integrators must use
pagination rather than assuming a bounded account history.

## Frontend transaction semantics

The frontend treats `ACCEPTED` as nonterminal. Protocol success requires
`FINALIZED` and `FINISHED_WITH_RETURN`. The SDK may expose `AGREE` or
`MAJORITY_AGREE`; neither is used as an extra success gate. Supplementary state
reads can warn about malformed or unavailable state, but they cannot revoke a
successful finalized execution or prove that no later transaction changed the
same record.

Activity is local browser data, validated on load and namespaced by chain,
contract, and wallet. It is not an authoritative index. Users should retain
transaction hashes and inspect the Bradbury explorer.

## Deployment position

Bradbury is a test network. V2 is active at
`0x7B939483E69ada6d2ca37acd3684182Ed141F35F`, and one market update is verified.
Before claiming full lifecycle completion, run clean local tests, browser
route/viewport QA, execute the remaining covenant writes with disposable
testnet GEN for fees, and preserve explorer plus state-read evidence.
