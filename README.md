# PriceOracle - GenLayer On-Chain Price Feed

PriceOracle is a GenLayer Bradbury testnet oracle that stores crypto and forex price records on-chain. The frontend reads the latest accepted contract state from Bradbury; it does not submit update transactions on a timer.

## Live App

https://price-oracle-delta.vercel.app

## Network And Contract

- Network: GenLayer Bradbury Testnet
- Contract address: `0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B`
- Contract source: `contracts/price_oracle.py`
- Explorer: `https://explorer-bradbury.genlayer.com/address/0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B`
- Contract proof: the deployed Bradbury contract is verifiable at the explorer link above.
- Update transaction proof: `0x0e87e2e6cccfae6467ad8f17574f3b1d10088a309b9c7d1eea5cdca99c51951e`

## What Validators Check

The contract uses `gl.eq_principle.prompt_non_comparative` around nondeterministic web requests. The consensus criteria are format-oriented because public prices can change between validator calls.

For crypto updates, validators check that the result is valid JSON with:

- `symbol` equal to the requested trading pair
- `price` as a non-empty positive number string
- `source` equal to `binance`

For forex updates, validators check that the result is valid JSON with:

- `base` and `quote` equal to the requested currencies
- `rate` as a non-empty positive number string
- `source` equal to the selected data provider

The deployed contract does not independently prove that a returned price or rate is the correct market value. It validates response structure, expected fields, and positive numeric values before storing accepted state.

## Data Sources

- Crypto: Binance public ticker price API
- Major forex pairs: Frankfurter API using ECB-based rates
- African forex pairs: ExchangeRate API

Tracked pairs in the frontend:

- Crypto: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`
- Forex: `USD/NGN`, `USD/GHS`, `USD/KES`, `USD/EUR`, `USD/GBP`

## Contract Methods

- `update_crypto_price(symbol)` - fetches a Binance trading pair price and stores an accepted crypto record.
- `update_forex_rate(base, quote)` - fetches a forex rate and stores an accepted forex record.
- `get_price(symbol)` - returns the latest stored record for one symbol or pair.
- `get_all_prices()` - returns all stored records in `symbol_list` order.
- `get_supported_symbols()` - returns all symbols currently tracked by the contract.
- `get_stats()` - returns total tracked symbols and total update count.

## Frontend Behavior

The Next.js API route at `app/api/prices/route.ts` uses `genlayer-js` to read `get_all_prices` and `get_stats` from the deployed contract with `stateStatus: 'accepted'`.

The page polls `/api/prices` every 30 seconds. This refresh interval only re-reads the latest accepted on-chain oracle state; it does not update prices on-chain or send write transactions.

## Verification

```bash
npm install
npm run lint
npm run build
```

`npm run build` uses Next.js 16 with Turbopack. In this development environment, the build may need permission to run outside a restricted sandbox because Turbopack/PostCSS spawns a worker process that binds a local port.

## Contract Change Policy

The published contract address points to the currently deployed contract. Strengthening validator criteria in `contracts/price_oracle.py` would change contract behavior and should be treated as requiring redeployment plus updated address and transaction proof. This repository should not claim stronger validation for the deployed address until that redeployment is done and documented.
