# Bradbury deployment record and remaining QA

PriceGuard V2 is deployed on GenLayer Bradbury Testnet (chain ID 4221). This
record does not authorize another deployment.

## Active deployment

- Contract: `0x7B939483E69ada6d2ca37acd3684182Ed141F35F`
- Deployment transaction: `0x0bec3ce3653dab8e1135bf2a2b547816905c132d78dabfc1f998f898c3f6bf69`
- First successful market refresh transaction: `0x7516d2370b7067d1cfbde1ee8ec21ca0294e85f3902ac2c0b9c702f5aba6b313`
- Deployed contract source SHA-256: `bdd0fac72f9659d76e03c04c60d55f1be4a46127da691fa9265cc77bd10b125a`
- Deployment source commit: `645e49a73e32cc0fdb12fda459d0fc7fa3b4d8f9`
- Production frontend: <https://price-oracle-delta.vercel.app>

The first market update is verified. The contract is non-custodial: it has no
payable, balance, transfer, claim, refund, or settlement path. The full covenant
create/evaluate/expire/acknowledge lifecycle remains unverified.

## Clean local gate

1. Run every command in `docs/TESTING.md` from `npm ci`.
2. Confirm `contracts/price_oracle.py` is unchanged historical V1 evidence.
3. Confirm the V2 schema contains 17 public methods: seven writes and ten views.
4. Confirm no V2 method is payable and the active source contains no transfer,
   balance, claim, refund, or custody path.
5. Review the exact source endpoints, policy constants, timestamps, fixed-point
   bounds, deterministic IDs, retained indexes, and account pagination.
6. Complete browser QA for every active route at mobile, tablet, and desktop
   viewports, including disconnected, wrong-network, loading,
   malformed-data, not-found, and RPC-error states.

## Deployment configuration

The production configuration must use only the active V2 address. Never reuse
or relabel the V1 address.

Set for a reproducible frontend build:

```text
NEXT_PUBLIC_PRICEGUARD_V2_ADDRESS=0x7B939483E69ada6d2ca37acd3684182Ed141F35F
```

## Real lifecycle evidence

Use separate disposable wallets where needed and preserve receipt plus state
reads for:

1. Preserve the verified `refresh_market` evidence above and repeat only when
   fresh market evidence is required;
2. PERSONAL `create_covenant`;
3. BILATERAL `create_covenant`;
4. `accept_covenant`;
5. `cancel_unaccepted_covenant` on a separate covenant;
6. `evaluate_covenant` with an unsatisfied result;
7. `evaluate_covenant` with a satisfied result and exact attestation;
8. `expire_covenant` on a separate elapsed covenant;
9. PERSONAL acknowledgement and closure;
10. first and final BILATERAL acknowledgements.

For each write, wait for `FINALIZED`, require `FINISHED_WITH_RETURN`, then read
the relevant contract state. `ACCEPTED` is not final. Do not automatically
resubmit an unknown or delayed transaction.

## Final repository update

After real lifecycle QA, add the transaction and state-read evidence without
replacing the active deployment record above. Re-run the clean local gate and
perform production browser QA. Do not call the full lifecycle verified or the
system production-safe merely because one market update succeeded on testnet.
