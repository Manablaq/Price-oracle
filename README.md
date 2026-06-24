# PriceOracle — GenLayer On-Chain Price Feed

Live crypto and forex prices fetched from public APIs, verified by 5 independent AI validators on GenLayer, and stored on-chain.

## Contract
- **Address:** `0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B` (Bradbury Testnet)
- **File:** `contracts/price_oracle.py`

## Live Pairs
**Crypto (Binance API)**
- BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT

**Forex — African (ExchangeRate API)**
- USD/NGN, USD/GHS, USD/KES

**Forex — Major (Frankfurter/ECB)**
- USD/EUR, USD/GBP

## Methods
- `update_crypto_price(symbol)` — fetch and store crypto price from Binance
- `update_forex_rate(base, quote)` — fetch and store forex rate
- `get_price(symbol)` — read latest price with timestamp
- `get_all_prices()` — read all tracked pairs
- `get_supported_symbols()` — list all symbols
- `get_stats()` — total symbols and updates

## How It Works
Each price update is verified by 5 independent GenLayer validators using `gl.eq_principle.prompt_non_comparative`. Validators independently fetch from the same public API and verify the output format before writing to chain.

## Stack
- GenLayer Bradbury Testnet (Python Intelligent Contract)
- Binance Public API (crypto)
- Frankfurter/ECB API (major forex)
- ExchangeRate API (African forex — NGN, GHS, KES)
