# Bradbury deployment checklist

PriceGuard V2 is not deployed. This checklist does not authorize deployment.

## Clean local gate

1. Run every command in `docs/TESTING.md` from `npm ci`.
2. Confirm `contracts/price_oracle.py` is unchanged historical V1 evidence.
3. Confirm the V2 schema contains 17 public methods: seven writes and ten views.
4. Confirm no V2 method is payable and the active source contains no transfer,
   balance, claim, refund, or custody path.
5. Review the exact source endpoints, policy constants, timestamps, fixed-point
   bounds, deterministic IDs, retained indexes, and account pagination.
6. Complete browser QA for every active route at mobile, tablet, and desktop
   viewports, including disconnected, wrong-network, undeployed, loading,
   malformed-data, not-found, and RPC-error states.

## Deploy

Deploy `contracts/priceguard.py` as a new contract on Testnet Bradbury. Never
reuse or relabel the V1 address. Record:

- new V2 contract address;
- deployment transaction hash;
- source SHA-256;
- runner dependency hash;
- chain ID 4221;
- generated schema;
- explorer links.

Set:

```text
NEXT_PUBLIC_PRICEGUARD_V2_ADDRESS=0x<new-v2-address>
```

Rebuild and deploy the frontend only after the address is present in every
configuration and document that requires it.

## Real lifecycle evidence

Use separate disposable wallets where needed and preserve receipt plus state
reads for:

1. `refresh_market`;
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

After real QA, update the V2 address, deployment transaction, source hash,
manual QA evidence, and live frontend URL. Re-run the clean local gate and
perform production browser QA. Do not call the system production-safe merely
because testnet smoke tests pass.
