# PriceOracle — GenLayer On-Chain Price Feed

Live crypto and forex prices fetched from public APIs, verified by 5 independent AI validators on GenLayer, and stored on-chain for any dApp to read.

## Live App
https://price-oracle-frontend-delta.vercel.app

## Contract
- **Address:** `0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B` (Bradbury Testnet)
- **File:** `contracts/price_oracle.py`

## Live Pairs
**Crypto — Binance API**
- BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT

**Forex — ExchangeRate API (African)**
- USD/NGN, USD/GHS, USD/KES

**Forex — Frankfurter/ECB (Major)**
- USD/EUR, USD/GBP

## How Any dApp Can Use It
```python
oracle = gl.contract.get_at(Address("0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B"))
price = json.loads(oracle.get_price("BTCUSDT"))["price"]
```

## Contract Methods
- `update_crypto_price(symbol)` — fetch and store from Binance
- `update_forex_rate(base, quote)` — fetch and store forex rate
- `get_price(symbol)` — read latest price with timestamp
- `get_all_prices()` — read all 9 tracked pairs
- `get_stats()` — total symbols and updates

## Stack
- GenLayer Bradbury Testnet (Python Intelligent Contract)
- Binance Public API · Frankfurter/ECB · ExchangeRate API
- Next.js 16 · Vercel
