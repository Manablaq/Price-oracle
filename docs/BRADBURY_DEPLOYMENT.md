# Bradbury deployment record

This document records the PriceGuard Covenant V2 deployment identity and the evidence required before any broader lifecycle claim. It does not authorize a deployment, redeployment, upgrade, or contract change.

## Active identity

| Field | Value |
| --- | --- |
| Product | PriceGuard Covenant V2 |
| Network | GenLayer Bradbury Testnet |
| Chain ID | `4221` (`0x107d`) |
| Native currency | `GEN`, 18 decimals |
| RPC | `https://rpc-bradbury.genlayer.com` |
| Explorer | `https://explorer-bradbury.genlayer.com` |
| Contract | `0x7B939483E69ada6d2ca37acd3684182Ed141F35F` |
| Production frontend | `https://price-oracle-delta.vercel.app` |
| Contract source SHA-256 | `bdd0fac72f9659d76e03c04c60d55f1be4a46127da691fa9265cc77bd10b125a` |
| Deployment source commit | `645e49a73e32cc0fdb12fda459d0fc7fa3b4d8f9` |
| Audit working-code commit | `13f096e` |

Production frontend configuration:

```text
NEXT_PUBLIC_PRICEGUARD_V2_ADDRESS=0x7B939483E69ada6d2ca37acd3684182Ed141F35F
```

The address is public configuration, not a secret. Never reuse or relabel the deprecated V1 address as V2.

## Verification position

The active deployment identity is recorded. The repository does not preserve enough evidence to verify the first market refresh's final status, execution result, resulting record ID, or matching state read. The complete covenant lifecycle is not verified. Bradbury is a test network, and these facts do not establish production safety.

PriceGuard V2 is non-custodial. The active contract has no payable method, GEN balance accounting, transfer, claim, refund, settlement, or external-execution path.

## Lifecycle evidence

The repository evidence supplied for this audit distinguishes a GenLayer transaction identifier, when separately recorded, from a chain transaction hash. Missing values are stated rather than inferred.

| Operation | Transaction ID | Chain transaction hash | Final status | Execution result | Resulting record ID | State read | Verification date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Contract deployment | Not preserved in repository evidence | `0x0bec3ce3653dab8e1135bf2a2b547816905c132d78dabfc1f998f898c3f6bf69` | Verified deployment identity | Not preserved in repository evidence | `0x7B939483E69ada6d2ca37acd3684182Ed141F35F` | Active contract address recorded | 2026-07-13 |

## Known deployment references

The repository preserves `0x7516d2370b7067d1cfbde1ee8ec21ca0294e85f3902ac2c0b9c702f5aba6b313` as the supplied reference for the first market refresh. Its classification as a GenLayer transaction identifier or a separate Bradbury chain transaction hash is **Not preserved in repository evidence**. The refresh's final status, execution result, resulting market sequence, and matching state read are also **Not preserved in repository evidence**. This reference is therefore not lifecycle verification.

The currently `ACCEPTED` PERSONAL creation transaction is deliberately omitted because it is awaiting finalization and no final state-read evidence was supplied. `ACCEPTED` is not a successful final status. Add a create row only after `FINALIZED`, `FINISHED_WITH_RETURN`, an exact resulting covenant ID, and a matching `get_covenant` read are preserved.

## Required lifecycle evidence

Use separate disposable wallets and covenants where states conflict. Preserve one structured row for each operation:

1. PERSONAL `create_covenant`;
2. BILATERAL `create_covenant`;
3. `accept_covenant`;
4. `cancel_unaccepted_covenant` on a separate pending covenant;
5. `evaluate_covenant` with `NOT_SATISFIED` and the exact attestation;
6. `evaluate_covenant` with `SATISFIED`, trigger fields, and the exact attestation;
7. `expire_covenant` on a separate elapsed pending or active covenant;
8. PERSONAL acknowledgement and closure;
9. first BILATERAL acknowledgement while status remains `TRIGGERED`; and
10. final BILATERAL acknowledgement and closure.

For every write, record both identifiers if the tooling exposes both, require `FINALIZED` and `FINISHED_WITH_RETURN`, then perform the appropriate exact state read. Preserve the observed record ID and verification date. Do not automatically resubmit a delayed or unknown transaction.

## Repository and browser gate

Before adding lifecycle claims:

1. Run the complete gate in [Testing](TESTING.md), including internal Markdown links.
2. Confirm `git diff -- contracts/priceguard.py` is empty for documentation/frontend-only work.
3. Confirm `contracts/price_oracle.py` remains deprecated V1 audit evidence.
4. Confirm the current V2 schema still has seven writes and ten views and no payable method.
5. Review source endpoints, freshness, fixed-point bounds, deterministic IDs, page limits, circular indexes, and owner pagination.
6. Complete browser QA for every active route at mobile, tablet, and desktop sizes, including disconnected, wrong-network, loading, malformed, not-found, and RPC-error states.
7. Verify the production frontend uses only the active V2 address.

Do not call the refresh or full lifecycle verified, or the system production-safe, without the required preserved finality and state-read evidence.
