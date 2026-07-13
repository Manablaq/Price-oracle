# Deprecated V1 review findings

## Preserved evidence

- Network: GenLayer Bradbury Testnet
- Legacy contract: [`0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B`](https://explorer-bradbury.genlayer.com/address/0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B)
- Preserved source: `contracts/price_oracle.py`
- Cited update transaction: [`0x0e87e2e6cccfae6467ad8f17574f3b1d10088a309b9c7d1eea5cdca99c51951e`](https://explorer-bradbury.genlayer.com/tx/0x0e87e2e6cccfae6467ad8f17574f3b1d10088a309b9c7d1eea5cdca99c51951e)

Read-only Bradbury RPC inspection on July 13, 2026 found that the deployed code contains the same format-only criteria as the repository. The cited update was `FINALIZED`, consensus `AGREE`, execution `FINISHED_WITH_RETURN`, and called `update_crypto_price` with `BTCUSDT`. Its leader output was Binance-shaped JSON. This is evidence of an accepted update, not proof that its numeric value was market-correct.

## Shape-only weakness

Both V1 write methods use `gl.eq_principle.prompt_non_comparative`. Their criteria explicitly instruct validators not to evaluate whether the price or rate is correct. V1 checks labels, non-empty JSON fields, and a positive Python `float`. A shape-valid materially wrong value can satisfy those stated criteria. Binary floating-point, arbitrary syntactically valid pairs, and no independent median or source dispersion add further limitations.

V1 must never be described as independently verifying price correctness.

## Read-oriented product weakness

The historical frontend exposes `/` and `/api/prices`. The API reads `get_all_prices` and `get_stats`; the page polls that accepted state every 30 seconds. Polling does not refresh the contract. V1 has no wallet connection, write UX, user-created state, conditional settlement, or transaction finality checks. `get_all_prices` also scans the full stored symbol list without pagination.

## Status

V1 is deprecated and retained for audit history. It is not PriceGuard V2. The
V1 source and address remain preserved and must not be relabelled or
retroactively strengthened. V2 has a separate source, deployment, and address.
