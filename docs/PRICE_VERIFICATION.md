# Price Verification

## Allowlist decision

Policy `BTCUSD-1` supports only `BTC/USD`. Legacy crypto and FX pairs were not carried forward because the audit did not prove three suitable independent public observations for every pair. Unsupported symbols fail before a nondeterministic request.

| Source | Operator / venue | Endpoint and pair | Authentication | Timestamp | Published limits / availability evidence |
|---|---|---|---|---|---|
| Coinbase Exchange | Coinbase exchange order book | `GET https://api.exchange.coinbase.com/products/BTC-USD/ticker` | Public; private endpoints require authentication | ISO `time` on latest trade | [Official docs](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker); [10 req/s/IP, burst 15](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits) |
| Bitstamp | Bitstamp exchange order book | `GET https://www.bitstamp.net/api/v2/ticker/btcusd/` | Public ticker; private calls authenticated | Unix `timestamp` | [Official API](https://www.bitstamp.net/api/): 400 req/s and 10,000 per 10 minutes |
| Gemini | Gemini exchange order book | `GET https://api.gemini.com/v1/trades/btcusd?limit_trades=1` | Public | Unix `timestamp` and `timestampms` | [Official market-data docs](https://docs.gemini.com/rest-api/); documents 429 responses but the reviewed page does not state a numeric public allowance |

The endpoints returned the documented pair and response shapes without credentials during the audit. Coinbase, Bitstamp, and Gemini are distinct exchange operators, so no one source is an API wrapper for another. They are nevertheless economically correlated BTC/USD venues and may share cloud/network dependencies. Independence is organizational and observational, not absolute.

Kraken was evaluated but timed out from the audit environment and is not an active source. PriceGuard does not silently count it.

## Fixed-point parser

Consensus-critical prices are integer cents. The parser:

- accepts only unsigned plain decimal strings;
- rejects exponent notation and signs;
- requires at most 12 integer and 8 fractional digits;
- rounds excess source precision to the two-decimal policy scale using deterministic half-up integer logic;
- rejects zero and values above `10^24` scaled units;
- serializes JSON with `sort_keys=True` and compact separators.

No binary floating-point is used for market arithmetic.

## Leader algorithm

1. Fetch every fixed endpoint independently with source-specific parsing.
2. Represent each configured source exactly once, including explicit failed records.
3. Reject malformed, non-positive, future-skewed by more than 30 seconds, or older-than-120-second observations.
4. Require at least two candidates.
5. With three candidates, calculate a preliminary median and exclude observations more than 100 bps from it.
6. Require two accepted observations; compute the integer median, min, max, and `spread_bps = floor(abs(max-min) * 10,000 / min)`.
7. Set the circuit breaker above 100 bps spread; a breaker result cannot be stored.
8. Return canonical JSON containing all raw records, accepted observations, derived fields, symbol, asset class, decimals, and policy version.

Confidence is `HIGH` only with all three venues and spread at most 25 bps; `MEDIUM` requires at least two venues and spread at most 75 bps; otherwise it is `LOW`. A non-breaker LOW snapshot may be stored by a manual market refresh for transparency, but covenant evaluation requires three-source `HIGH` confidence and will reject it.

## Validator algorithm

1. Require a successful `gl.vm.Return`, exact symbol, asset class, decimals, and policy version.
2. Require all three raw source entries. Independently recompute the leader’s accepted observations, median, min, max, spread, rejection count, confidence, and breaker flag. Any shape-valid forged field fails.
3. Independently fetch all configured sources and run the same normalization and circuit-breaker policy.
4. Compare leader and validator medians; reject disagreement above 50 bps.
5. Return `True` only with adequate independent validator evidence.

The 50 bps tolerance permits legitimate movement between sequential validator HTTP calls. The 100 bps source-spread cap limits venue divergence. The 100 bps outlier threshold lets two close venues reject one extreme print. These are policy choices, not mathematical guarantees; boundary tests are included.

## Storage and covenant-trigger eligibility

Failed verification does not overwrite `get_market`. Only a non-breaker result is assigned a sequence and placed in the 32-entry circular history. Market previews may be degraded, but covenant evaluation requires all three unique sources, HIGH confidence, fresh timestamps, protocol spread limits, and validator agreement. API preview data is never accepted as contract evidence. Attestations are evidence only and never represent payment or settlement.
