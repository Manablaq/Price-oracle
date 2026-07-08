# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

# GenLayer Price Oracle
# Fetches and stores on-chain prices after GenLayer validator consensus checks
#
# Crypto: Binance API (api.binance.com/api/v3/ticker/price) — no auth, public
# Major forex: Frankfurter (api.frankfurter.dev/v2/rates) — no auth, ECB data
# African forex: ExchangeRate API (open.er-api.com/v6/latest) — no auth, covers NGN/GHS/KES
#
# Consensus: gl.eq_principle.prompt_non_comparative with format-only criteria
# (prices change between validator calls, so strict_eq would fail)
# Validators check JSON shape, expected symbol/source fields, and positive numeric values.
# They do not independently prove the market price is correct.
#
# gl.message_raw["datetime"] for timestamps
# Storage writes OUTSIDE nondet blocks
# DynArray[str] for ordered symbol list
# TreeMap[str, str] for price records


def _safe_json(text: str) -> dict:
    try:
        s = text.strip()
        if s.startswith("```"):
            s = s.split("```")[1]
            if s.startswith("json"):
                s = s[4:]
        return json.loads(s.strip())
    except:
        return {}


class PriceOracle(gl.Contract):
    # symbol → JSON price record string
    prices: TreeMap[str, str]
    # ordered list of all tracked symbols (for get_all_prices iteration)
    symbol_list: DynArray[str]
    # total number of price updates ever made
    update_count: str

    def __init__(self):
        self.update_count = "0"

    # ── WRITE METHODS ──────────────────────────────────────────────────────────

    @gl.public.write
    def update_crypto_price(self, symbol: str) -> None:
        """
        Fetch and store the latest price for a crypto trading pair from Binance.
        symbol: e.g. "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "MATICUSDT"
        Binance market data endpoints are public — no API key required.
        """
        symbol = symbol.upper().strip()
        assert len(symbol) >= 5 and len(symbol) <= 20, "Invalid symbol. Example: BTCUSDT"

        url = "https://api.binance.com/api/v3/ticker/price?symbol=" + symbol
        now_str = gl.message_raw["datetime"]

        # ── NONDET BLOCK ───────────────────────────────────────────────────────
        def _fetch_crypto() -> str:
            try:
                response = gl.nondet.web.get(url)
                data = json.loads(response.body.decode("utf-8"))
                price = str(data.get("price", ""))
                # Validate before returning
                float(price)
                assert float(price) > 0
                return json.dumps({
                    "symbol": symbol,
                    "price": price,
                    "source": "binance",
                })
            except:
                return json.dumps({"symbol": symbol, "price": "", "source": "binance"})

        result_raw = gl.eq_principle.prompt_non_comparative(
            _fetch_crypto,
            task=(
                f"Fetch the current {symbol} price from the Binance public API "
                f"at: {url} "
                f"Return the result as a JSON object with fields: symbol, price, source."
            ),
            criteria=(
                "Validate format only. Accept if ALL of these are true: "
                f"(1) valid JSON object, "
                f"(2) 'symbol' field is '{symbol}', "
                "(3) 'price' field is a non-empty string representing a positive number, "
                "(4) 'source' field is 'binance'. "
                "Do not evaluate whether the price value is correct — format check only."
            ),
        )
        # ── END NONDET ─────────────────────────────────────────────────────────

        result = _safe_json(result_raw)
        price = str(result.get("price", "")).strip()

        assert price, f"Could not fetch price for {symbol}. Check symbol is valid on Binance."
        try:
            assert float(price) > 0, "Price must be positive"
        except ValueError:
            assert False, f"Price is not a valid number: {price}"

        # Track new symbols
        is_new = self.prices.get(symbol, None) is None
        if is_new:
            self.symbol_list.append(symbol)

        # Store price record
        self.prices[symbol] = json.dumps({
            "symbol": symbol,
            "price": price,
            "source": "binance",
            "type": "crypto",
            "updated_at": now_str,
        })

        try:
            self.update_count = str(int(self.update_count) + 1)
        except:
            self.update_count = "1"

    @gl.public.write
    def update_forex_rate(self, base: str, quote: str) -> None:
        """
        Fetch and store a forex exchange rate.
        - Major pairs (EUR, GBP, JPY, CHF, etc.) → Frankfurter (ECB data)
        - African currencies (NGN, GHS, KES, ZAR) → ExchangeRate API
        base: 3-letter ISO currency code, e.g. "USD"
        quote: 3-letter ISO currency code, e.g. "NGN"
        """
        base = base.upper().strip()
        quote = quote.upper().strip()
        assert len(base) == 3, "Base currency must be 3-letter ISO code e.g. USD"
        assert len(quote) == 3, "Quote currency must be 3-letter ISO code e.g. NGN"
        assert base != quote, "Base and quote cannot be the same currency"

        symbol = base + "/" + quote
        now_str = gl.message_raw["datetime"]

        # Route to correct API based on currency
        african_currencies = ["NGN", "GHS", "KES", "ZAR", "XOF", "EGP", "MAD"]
        if quote in african_currencies or base in african_currencies:
            url = "https://open.er-api.com/v6/latest/" + base
            source = "exchangerate-api"
            rate_field = quote
        else:
            url = "https://api.frankfurter.dev/v2/rates?base=" + base + "&quotes=" + quote
            source = "frankfurter"
            rate_field = quote

        # ── NONDET BLOCK ───────────────────────────────────────────────────────
        def _fetch_forex() -> str:
            try:
                response = gl.nondet.web.get(url)
                data = json.loads(response.body.decode("utf-8"))
                rates = data.get("rates", {})
                rate = str(rates.get(rate_field, ""))
                float(rate)
                assert float(rate) > 0
                return json.dumps({
                    "base": base,
                    "quote": quote,
                    "rate": rate,
                    "source": source,
                })
            except:
                return json.dumps({"base": base, "quote": quote, "rate": "", "source": source})

        result_raw = gl.eq_principle.prompt_non_comparative(
            _fetch_forex,
            task=(
                f"Fetch the {base}/{quote} exchange rate from {source} at: {url} "
                f"Return the result as JSON with fields: base, quote, rate, source."
            ),
            criteria=(
                "Validate format only. Accept if ALL of these are true: "
                f"(1) valid JSON object, "
                f"(2) 'base' field is '{base}', "
                f"(3) 'quote' field is '{quote}', "
                "(4) 'rate' field is a non-empty string representing a positive number, "
                f"(5) 'source' field is '{source}'. "
                "Do not evaluate whether the rate value is correct — format check only."
            ),
        )
        # ── END NONDET ─────────────────────────────────────────────────────────

        result = _safe_json(result_raw)
        rate = str(result.get("rate", "")).strip()

        assert rate, f"Could not fetch rate for {symbol}. Check currency codes are valid."
        try:
            assert float(rate) > 0, "Rate must be positive"
        except ValueError:
            assert False, f"Rate is not a valid number: {rate}"

        # Track new symbols
        is_new = self.prices.get(symbol, None) is None
        if is_new:
            self.symbol_list.append(symbol)

        # Store rate record
        self.prices[symbol] = json.dumps({
            "symbol": symbol,
            "base": base,
            "quote": quote,
            "rate": rate,
            "source": source,
            "type": "forex",
            "updated_at": now_str,
        })

        try:
            self.update_count = str(int(self.update_count) + 1)
        except:
            self.update_count = "1"

    # ── READ METHODS ───────────────────────────────────────────────────────────

    @gl.public.view
    def get_price(self, symbol: str) -> str:
        """
        Get the latest price or rate for a symbol.
        Crypto: pass symbol e.g. "BTCUSDT"
        Forex: pass pair e.g. "USD/NGN"
        """
        raw = self.prices.get(symbol.upper(), None)
        if raw is None:
            return json.dumps({"found": False, "symbol": symbol})
        record = json.loads(raw)
        record["found"] = True
        return json.dumps(record)

    @gl.public.view
    def get_all_prices(self) -> str:
        """Return all tracked price and rate records."""
        result = []
        for symbol in self.symbol_list:
            raw = self.prices.get(symbol, None)
            if raw:
                try:
                    result.append(json.loads(raw))
                except:
                    pass
        return json.dumps(result)

    @gl.public.view
    def get_supported_symbols(self) -> str:
        """List all symbols currently tracked by the oracle."""
        result = []
        for s in self.symbol_list:
            result.append(s)
        return json.dumps(result)

    @gl.public.view
    def get_stats(self) -> str:
        """Oracle stats: symbol count, total updates."""
        count = 0
        for _ in self.symbol_list:
            count += 1
        return json.dumps({
            "total_symbols": str(count),
            "total_updates": self.update_count or "0",
        })
