# v0.3.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""PriceGuard Covenant: non-custodial market attestations for GenLayer.

This contract never accepts or transfers GEN. It records independently
verified market evidence and user-authored covenant state only.
"""
from genlayer import *
import hashlib
import json
from datetime import datetime
from dataclasses import dataclass

POLICY_VERSION = "BTCUSD-1"
SUPPORTED_SYMBOL = "BTC/USD"
ASSET_CLASS = "CRYPTO_SPOT"
SOURCE_NAMES = ["coinbase", "bitstamp", "gemini"]
SOURCE_COUNT = 3
DECIMALS = 2
REQUIRED_SOURCE_COUNT = 2
MAX_OBSERVATION_AGE = 120
MAX_FUTURE_SKEW = 30
MAX_SOURCE_SPREAD_BPS = 100
LEADER_VALIDATOR_TOLERANCE_BPS = 50
OUTLIER_BPS = 100
HIGH_CONFIDENCE_SPREAD_BPS = 25
MEDIUM_CONFIDENCE_SPREAD_BPS = 75
MAX_RESPONSE_LENGTH = 16_384
MAX_COVENANT_ID_LENGTH = 96
MAX_REQUEST_ID_LENGTH = 48
MAX_VALIDITY_SECONDS = 365 * 24 * 60 * 60
MAX_MEMO_LENGTH = 280
HISTORY_LIMIT = 32
ATTESTATION_LIMIT = 256
PAGE_LIMIT = 50
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
CONDITIONS = ["ABOVE", "BELOW", "AT_OR_ABOVE", "AT_OR_BELOW", "IN_RANGE"]
CONFIDENCE_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}


@allow_storage
@dataclass
class Covenant:
    covenant_id: str
    client_request_id: str
    mode: str
    creator: str
    counterparty: str
    symbol: str
    condition_type: str
    threshold_low: str
    threshold_high: str
    decimals: str
    valid_from: str
    expiry: str
    minimum_confidence: str
    maximum_spread_bps: str
    status: str
    accepted_at: str
    last_evaluated_at: str
    evaluation_count: str
    trigger_snapshot_sequence: str
    trigger_attestation_id: str
    triggered_at: str
    creator_acknowledged: bool
    counterparty_acknowledged: bool
    closed_at: str
    memo: str
    external_reference_hash: str
    revision_of: str
    policy_version: str


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _covenant_dict(c):
    d = dict(c.__dict__) if isinstance(c, Covenant) else dict(c)
    d["decimals"] = int(d["decimals"])
    d["maximum_spread_bps"] = int(d["maximum_spread_bps"])
    return d


def _now_epoch():
    raw = str(gl.message_raw["datetime"]).strip()
    if raw.isdigit():
        value = int(raw)
        return value // 1000 if value >= 10**12 else value
    parsed = datetime.fromisoformat(raw[:-1] + "+00:00" if raw.endswith("Z") else raw)
    assert parsed.tzinfo is not None, "datetime timezone required"
    return int(parsed.timestamp())


def _parse_decimal(value, scale=DECIMALS):
    text = str(value).strip()
    assert text and text.isascii() and "e" not in text.lower() and not text.startswith(("+", "-"))
    assert text.count(".") <= 1
    parts = text.split(".")
    whole, fraction = parts[0], parts[1] if len(parts) == 2 else ""
    assert whole.isdigit() and fraction.isdigit() if fraction else whole.isdigit()
    assert len(whole) <= 12 and len(fraction) <= 8
    kept = fraction[:scale].ljust(scale, "0")
    scaled = int(whole) * (10 ** scale) + (int(kept) if kept else 0)
    if len(fraction) > scale and fraction[scale] >= "5":
        scaled += 1
    assert 0 < scaled <= 10**24
    return scaled


def _parse_threshold(value):
    text = str(value).strip()
    assert text and text.isascii() and not text.startswith(("+", "-")) and "e" not in text.lower()
    assert text.count(".") <= 1
    parts = text.split("."); whole = parts[0]; fraction = parts[1] if len(parts) == 2 else ""
    assert whole.isdigit() and (not fraction or fraction.isdigit())
    assert len(whole) <= 12 and len(fraction) <= 2
    scaled = int(whole) * 100 + (int(fraction.ljust(2, "0")) if fraction else 0)
    assert 0 < scaled <= 10**14
    return scaled


def _parse_timestamp(value):
    text = str(value).strip()
    assert text.isdigit() and len(text) <= 12 and str(int(text)) == text
    return int(text)


def _bps_delta(a, b):
    return abs(a - b) * 10000 // min(a, b)


def _median(values):
    ordered = sorted(values)
    assert ordered
    n = len(ordered)
    return ordered[n // 2] if n % 2 else (ordered[n // 2 - 1] + ordered[n // 2]) // 2


def _derive(observations, now_epoch, require_all=False):
    assert isinstance(observations, list) and len(observations) == SOURCE_COUNT
    seen, candidates, rejected = [], [], 0
    for item in observations:
        assert isinstance(item, dict) and len(item) <= 5
        source = str(item.get("source", ""))
        assert source in SOURCE_NAMES and source not in seen
        seen.append(source)
        if not bool(item.get("ok", False)):
            rejected += 1
            continue
        price_text = str(item.get("price", ""))
        assert price_text.isdigit() and str(int(price_text)) == price_text
        price = int(price_text)
        observed_at = _parse_timestamp(item.get("observed_at", "0"))
        assert 0 < price <= 10**24
        assert observed_at <= now_epoch + MAX_FUTURE_SKEW
        assert now_epoch - observed_at <= MAX_OBSERVATION_AGE
        candidates.append({"source": source, "price": price_text, "observed_at": str(observed_at)})
    assert sorted(seen) == sorted(SOURCE_NAMES)
    if require_all:
        assert len(candidates) == SOURCE_COUNT
    assert len(candidates) >= REQUIRED_SOURCE_COUNT
    preliminary = _median([int(x["price"]) for x in candidates])
    accepted = []
    for item in candidates:
        if len(candidates) >= 3 and _bps_delta(int(item["price"]), preliminary) > OUTLIER_BPS:
            rejected += 1
        else:
            accepted.append(item)
    assert len(accepted) >= REQUIRED_SOURCE_COUNT
    prices = [int(x["price"]) for x in accepted]
    spread = _bps_delta(max(prices), min(prices))
    confidence = "HIGH" if len(accepted) == 3 and spread <= HIGH_CONFIDENCE_SPREAD_BPS else ("MEDIUM" if spread <= MEDIUM_CONFIDENCE_SPREAD_BPS else "LOW")
    return {"observations": sorted(accepted, key=lambda x: x["source"]), "valid_source_count": len(accepted), "rejected_source_count": rejected, "median_price": str(_median(prices)), "minimum_observation": str(min(prices)), "maximum_observation": str(max(prices)), "spread_bps": spread, "confidence": confidence, "circuit_breaker": spread > MAX_SOURCE_SPREAD_BPS}


def _failed(source):
    return {"source": source, "ok": False, "price": "0", "observed_at": "0"}


def _fetch_observations():
    out = []
    endpoints = [
        ("coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/ticker", "price", "time"),
        ("bitstamp", "https://www.bitstamp.net/api/v2/ticker/btcusd/", "last", "timestamp"),
        ("gemini", "https://api.gemini.com/v1/trades/btcusd?limit_trades=1", "price", "timestampms"),
    ]
    for source, url, price_field, time_field in endpoints:
        try:
            response = gl.nondet.web.get(url)
            body = response.body.decode("utf-8")
            assert len(body) <= MAX_RESPONSE_LENGTH
            data = json.loads(body)
            if source == "gemini":
                assert isinstance(data, list) and len(data) == 1 and len(data[0]) <= 8
                data = data[0]
                timestamp = str(int(str(data[time_field])) // 1000)
            else:
                assert isinstance(data, dict) and len(data) <= 16
                timestamp = str(data[time_field])
                if source == "coinbase":
                    parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                    timestamp = str(int(parsed.timestamp()))
            out.append({"source": source, "ok": True, "price": str(_parse_decimal(data[price_field])), "observed_at": timestamp})
        except Exception:
            out.append(_failed(source))
    return sorted(out, key=lambda x: x["source"])


def _leader_payload(symbol, now):
    obs = _fetch_observations()
    return _canonical({"symbol": symbol, "asset_class": ASSET_CLASS, "decimals": DECIMALS, "policy_version": POLICY_VERSION, "raw_observations": obs, **_derive(obs, now)})


def _validate_leader(result, symbol, now, require_all=False):
    try:
        if not isinstance(result, gl.vm.Return):
            return False
        data = json.loads(str(result.calldata))
        expected = {"symbol","asset_class","decimals","policy_version","raw_observations","observations","valid_source_count","rejected_source_count","median_price","minimum_observation","maximum_observation","spread_bps","confidence","circuit_breaker"}
        if not isinstance(data, dict) or set(data.keys()) != expected:
            return False
        if not isinstance(data["symbol"], str) or not isinstance(data["asset_class"], str) or not isinstance(data["policy_version"], str) or not isinstance(data["decimals"], int) or isinstance(data["decimals"], bool):
            return False
        if data["symbol"] != symbol or data["asset_class"] != ASSET_CLASS or data["policy_version"] != POLICY_VERSION or data["decimals"] != DECIMALS:
            return False
        if not isinstance(data["raw_observations"], list) or not isinstance(data["observations"], list): return False
        if not isinstance(data["valid_source_count"], int) or isinstance(data["valid_source_count"], bool) or not isinstance(data["rejected_source_count"], int) or isinstance(data["rejected_source_count"], bool) or not isinstance(data["spread_bps"], int) or isinstance(data["spread_bps"], bool) or not isinstance(data["circuit_breaker"], bool) or data["confidence"] not in ["LOW","MEDIUM","HIGH"]: return False
        for item in data["raw_observations"]:
            if not isinstance(item, dict) or set(item.keys()) != {"source","ok","price","observed_at"} or not isinstance(item["source"], str) or not isinstance(item["ok"], bool) or not isinstance(item["price"], str) or not isinstance(item["observed_at"], str): return False
        for key in ("median_price","minimum_observation","maximum_observation"):
            if not isinstance(data[key], str) or not data[key].isdigit(): return False
        derived = _derive(data.get("raw_observations", []), now, require_all=require_all)
        if require_all and (derived["valid_source_count"] != SOURCE_COUNT or derived["confidence"] != "HIGH" or derived["spread_bps"] > MAX_SOURCE_SPREAD_BPS or derived["circuit_breaker"]):
            return False
        if _canonical(data.get("observations", [])) != _canonical(derived.get("observations", [])):
            return False
        for key in ("valid_source_count", "rejected_source_count", "median_price", "minimum_observation", "maximum_observation", "spread_bps", "confidence", "circuit_breaker"):
            if data.get(key) != derived.get(key):
                return False
        validator = _derive(_fetch_observations(), now, require_all=require_all)
        if require_all and (validator["valid_source_count"] != SOURCE_COUNT or validator["confidence"] != "HIGH" or validator["spread_bps"] > MAX_SOURCE_SPREAD_BPS or validator["circuit_breaker"]):
            return False
        return not validator["circuit_breaker"] and _bps_delta(int(derived["median_price"]), int(validator["median_price"])) <= LEADER_VALIDATOR_TOLERANCE_BPS
    except Exception:
        return False


def _address(value):
    text = str(value)
    assert len(text) == 42 and text.startswith("0x") and text.lower() != ZERO_ADDRESS
    int(text[2:], 16)
    return text.lower()


def _id(creator, request):
    return "cov_" + hashlib.sha256((creator.lower() + ":" + request).encode("ascii")).hexdigest()[:48]


def _attestation_id(covenant_id, sequence):
    return "att_" + hashlib.sha256((covenant_id + ":" + str(sequence)).encode("ascii")).hexdigest()[:48]


def _condition(kind, price, low, high):
    return {"ABOVE": price > low, "BELOW": price < low, "AT_OR_ABOVE": price >= low, "AT_OR_BELOW": price <= low, "IN_RANGE": low <= price <= high}.get(kind, False)


def _assert_counter_invariant(contract):
    total = int(contract.covenant_count)
    states = sum(int(getattr(contract, name)) for name in ["pending_count", "active_count", "triggered_count", "expired_count", "canceled_count", "closed_count"])
    assert total == states
    assert total == int(contract.personal_count) + int(contract.bilateral_count)


class PriceGuard(gl.Contract):
    markets: TreeMap[str, str]
    market_history: TreeMap[str, str]
    market_counts: TreeMap[str, str]
    market_starts: TreeMap[str, str]
    covenants: TreeMap[str, str]
    creator_index: TreeMap[str, str]
    counterparty_index: TreeMap[str, str]
    creator_counts: TreeMap[str, str]
    counterparty_counts: TreeMap[str, str]
    attestations: TreeMap[str, str]
    covenant_evaluations: TreeMap[str, str]
    attestation_index: TreeMap[str, str]
    attestation_count: str
    market_update_count: str
    covenant_count: str
    personal_count: str
    bilateral_count: str
    pending_count: str
    active_count: str
    triggered_count: str
    expired_count: str
    canceled_count: str
    closed_count: str
    next_sequence: str

    def __init__(self):
        self.next_sequence = "1"
        self.attestation_count = "0"
        for name in ["market_update_count","covenant_count","personal_count","bilateral_count","pending_count","active_count","triggered_count","expired_count","canceled_count","closed_count"]: setattr(self, name, "0")

    def _store_market(self, payload, now):
        data = json.loads(payload)
        assert not data["circuit_breaker"]
        data.pop("raw_observations", None)
        data.update({"transaction_epoch": str(now), "update_sequence": self.next_sequence, "updater": str(gl.message.sender_address)})
        self.next_sequence = str(int(self.next_sequence) + 1)
        raw = _canonical(data)
        self.markets[SUPPORTED_SYMBOL] = raw
        count = int(self.market_counts.get(SUPPORTED_SYMBOL, "0")); start = int(self.market_starts.get(SUPPORTED_SYMBOL, "0"))
        slot = (start + count) % HISTORY_LIMIT if count < HISTORY_LIMIT else start
        if count < HISTORY_LIMIT: count += 1
        else: start = (start + 1) % HISTORY_LIMIT
        self.market_history[SUPPORTED_SYMBOL + ":" + str(slot)] = raw
        self.market_counts[SUPPORTED_SYMBOL] = str(count); self.market_starts[SUPPORTED_SYMBOL] = str(start)
        self.market_update_count = str(int(self.market_update_count) + 1)
        return data

    def _get(self, cid):
        raw = self.covenants.get(cid, None); assert raw is not None, "covenant not found"
        return Covenant(**json.loads(str(raw)))

    def _save(self, c):
        self.covenants[c.covenant_id] = _canonical(_covenant_dict(c))

    def _index(self, table, counts, owner, cid):
        key = owner.lower(); count = int(counts.get(key, "0"))
        table[key + ":" + str(count)] = cid; counts[key] = str(count + 1)

    @gl.public.write
    def refresh_market(self, symbol: str) -> str:
        assert str(symbol).upper().strip() == SUPPORTED_SYMBOL
        now = _now_epoch()
        def leader_fn(): return _leader_payload(SUPPORTED_SYMBOL, now)
        def validator_fn(result): return _validate_leader(result, SUPPORTED_SYMBOL, now, require_all=False)
        return str(self._store_market(gl.vm.run_nondet_unsafe(leader_fn, validator_fn), now)["update_sequence"])

    @gl.public.write
    def create_covenant(self, client_request_id: str, mode: str, counterparty: str, symbol: str, condition_type: str, threshold_low: str, threshold_high: str, valid_from: int, expiry: int, minimum_confidence: str, maximum_spread_bps: int, memo: str, external_reference_hash: str, revision_of: str) -> str:
        creator = _address(gl.message.sender_address); request = str(client_request_id)
        assert request.isascii() and 1 <= len(request) <= MAX_REQUEST_ID_LENGTH and all(ch.isalnum() or ch in "-_" for ch in request)
        mode = str(mode).upper(); assert mode in ["PERSONAL", "BILATERAL"]
        if mode == "PERSONAL": assert str(counterparty) == ZERO_ADDRESS; counterparty = ZERO_ADDRESS
        else: counterparty = _address(counterparty)
        assert mode == "PERSONAL" or counterparty != creator
        assert str(symbol).upper().strip() == SUPPORTED_SYMBOL
        kind = str(condition_type).upper(); assert kind in CONDITIONS
        confidence = str(minimum_confidence).upper(); assert confidence == "HIGH"
        now = _now_epoch(); assert int(expiry) > now and int(expiry) - now <= MAX_VALIDITY_SECONDS and int(valid_from) >= 0 and int(valid_from) <= int(expiry)
        low = _parse_threshold(threshold_low); high = _parse_threshold(threshold_high) if kind == "IN_RANGE" else 0
        if kind == "IN_RANGE": assert low <= high
        else: assert str(threshold_high).strip() in ["", "0"]
        assert 0 <= int(maximum_spread_bps) <= MAX_SOURCE_SPREAD_BPS and len(str(memo)) <= MAX_MEMO_LENGTH
        ref = str(external_reference_hash); assert ref == "" or (len(ref) == 66 and ref.startswith("0x") and all(ch in "0123456789abcdef" for ch in ref[2:]))
        revision = str(revision_of); assert revision == "" or self.covenants.get(revision, None) is not None
        if revision:
            prior = self._get(revision); assert prior.creator == creator and revision != _id(creator, request)
        cid = _id(creator, request); assert len(cid) <= MAX_COVENANT_ID_LENGTH and self.covenants.get(cid, None) is None
        status = "ACTIVE" if mode == "PERSONAL" else "PENDING_ACCEPTANCE"
        c = Covenant(cid, request, mode, creator, counterparty, SUPPORTED_SYMBOL, kind, str(low), str(high), str(DECIMALS), str(int(valid_from)), str(int(expiry)), confidence, str(int(maximum_spread_bps)), status, "0", "0", "0", "0", "", "0", False, False, "0", str(memo), str(external_reference_hash), str(revision_of), POLICY_VERSION)
        self._save(c); self._index(self.creator_index, self.creator_counts, creator, cid)
        self.covenant_count = str(int(self.covenant_count) + 1)
        if mode == "PERSONAL": self.personal_count = str(int(self.personal_count) + 1); self.active_count = str(int(self.active_count) + 1)
        else: self.bilateral_count = str(int(self.bilateral_count) + 1); self.pending_count = str(int(self.pending_count) + 1)
        if mode == "BILATERAL": self._index(self.counterparty_index, self.counterparty_counts, counterparty, cid)
        return cid

    @gl.public.write
    def accept_covenant(self, covenant_id: str) -> None:
        c = self._get(covenant_id); assert c.mode == "BILATERAL" and c.status == "PENDING_ACCEPTANCE" and _now_epoch() <= int(c.expiry) and str(gl.message.sender_address).lower() == c.counterparty
        assert int(self.pending_count) > 0; c.status = "ACTIVE"; c.accepted_at = str(_now_epoch()); self.pending_count = str(int(self.pending_count) - 1); self.active_count = str(int(self.active_count) + 1); self._save(c)

    @gl.public.write
    def cancel_unaccepted_covenant(self, covenant_id: str) -> None:
        c = self._get(covenant_id); assert c.status == "PENDING_ACCEPTANCE" and _now_epoch() <= int(c.expiry) and str(gl.message.sender_address).lower() == c.creator
        assert int(self.pending_count) > 0; c.status = "CANCELED"; self.pending_count = str(int(self.pending_count) - 1); self.canceled_count = str(int(self.canceled_count) + 1); self._save(c)

    @gl.public.write
    def evaluate_covenant(self, covenant_id: str) -> str:
        c = self._get(covenant_id); now = _now_epoch(); assert c.status == "ACTIVE" and now >= int(c.valid_from) and now <= int(c.expiry)
        def leader_fn(): return _leader_payload(c.symbol, now)
        def validator_fn(result): return _validate_leader(result, c.symbol, now, require_all=True)
        snapshot = self._store_market(gl.vm.run_nondet_unsafe(leader_fn, validator_fn), now)
        assert int(snapshot["valid_source_count"]) == 3 and snapshot["confidence"] == "HIGH" and not snapshot["circuit_breaker"]
        assert int(snapshot["spread_bps"]) <= int(c.maximum_spread_bps)
        sequence = int(c.evaluation_count) + 1; aid = _attestation_id(c.covenant_id, sequence)
        satisfied = _condition(c.condition_type, int(snapshot["median_price"]), int(c.threshold_low), int(c.threshold_high))
        att = {"schema_version": "priceguard-attestation-1", "attestation_id": aid, "covenant_id": c.covenant_id, "evaluation_sequence": sequence, "outcome": "SATISFIED" if satisfied else "NOT_SATISFIED", "symbol": c.symbol, "condition_type": c.condition_type, "threshold_low": c.threshold_low, "threshold_high": c.threshold_high, "evaluated_price": snapshot["median_price"], "decimals": DECIMALS, "snapshot_sequence": snapshot["update_sequence"], "valid_source_count": snapshot["valid_source_count"], "source_identities": SOURCE_NAMES, "minimum_observation": snapshot["minimum_observation"], "maximum_observation": snapshot["maximum_observation"], "spread_bps": snapshot["spread_bps"], "confidence": snapshot["confidence"], "circuit_breaker": False, "policy_version": POLICY_VERSION, "evaluated_at": str(now), "evaluator": str(gl.message.sender_address)}
        self.attestations[aid] = _canonical(att); self.covenant_evaluations[c.covenant_id + ":" + str(sequence % HISTORY_LIMIT)] = aid
        total_att = int(self.attestation_count); self.attestation_index[str(total_att % ATTESTATION_LIMIT)] = aid; self.attestation_count = str(total_att + 1)
        c.evaluation_count = str(sequence); c.last_evaluated_at = str(now)
        if satisfied and c.status == "ACTIVE": assert int(self.active_count) > 0; c.status = "TRIGGERED"; self.active_count = str(int(self.active_count) - 1); self.triggered_count = str(int(self.triggered_count) + 1); c.trigger_snapshot_sequence = str(snapshot["update_sequence"]); c.trigger_attestation_id = aid; c.triggered_at = str(now)
        self._save(c); return aid

    @gl.public.write
    def expire_covenant(self, covenant_id: str) -> None:
        c = self._get(covenant_id); previous = c.status; assert previous in ["ACTIVE", "PENDING_ACCEPTANCE"] and _now_epoch() > int(c.expiry)
        if previous == "ACTIVE": assert int(self.active_count) > 0; self.active_count = str(int(self.active_count) - 1)
        else: assert int(self.pending_count) > 0; self.pending_count = str(int(self.pending_count) - 1)
        c.status = "EXPIRED"; self.expired_count = str(int(self.expired_count) + 1); self._save(c)

    @gl.public.write
    def acknowledge_outcome(self, covenant_id: str) -> None:
        c = self._get(covenant_id); caller = str(gl.message.sender_address).lower(); assert c.status == "TRIGGERED"
        if caller == c.creator: assert not c.creator_acknowledged; c.creator_acknowledged = True
        elif c.mode == "BILATERAL" and caller == c.counterparty: assert not c.counterparty_acknowledged; c.counterparty_acknowledged = True
        else: assert False, "unauthorized acknowledgement"
        if c.creator_acknowledged and (c.mode == "PERSONAL" or c.counterparty_acknowledged): assert int(self.triggered_count) > 0; c.status = "CLOSED"; self.triggered_count = str(int(self.triggered_count) - 1); self.closed_count = str(int(self.closed_count) + 1); c.closed_at = str(_now_epoch())
        self._save(c)

    @gl.public.view
    def get_market(self, symbol: str) -> str:
        assert str(symbol).upper().strip() == SUPPORTED_SYMBOL
        raw = self.markets.get(SUPPORTED_SYMBOL, None); return _canonical({"found": False, "symbol": SUPPORTED_SYMBOL}) if raw is None else _canonical({**json.loads(str(raw)), "found": True})

    @gl.public.view
    def get_market_history(self, symbol: str, offset: int, limit: int) -> str:
        assert str(symbol).upper().strip() == SUPPORTED_SYMBOL and offset >= 0 and 0 <= limit <= PAGE_LIMIT
        count = int(self.market_counts.get(SUPPORTED_SYMBOL, "0")); start = int(self.market_starts.get(SUPPORTED_SYMBOL, "0")); result = []
        for i in range(offset, min(count, offset + limit)):
            slot = (start + count - 1 - i) % HISTORY_LIMIT; raw = self.market_history.get(SUPPORTED_SYMBOL + ":" + str(slot), None)
            if raw is not None: result.append(json.loads(str(raw)))
        return _canonical({"items": result, "offset": offset, "limit": limit, "total": count})

    @gl.public.view
    def get_supported_markets(self) -> str: return _canonical([{"symbol": SUPPORTED_SYMBOL, "asset_class": ASSET_CLASS, "decimals": DECIMALS, "sources": SOURCE_NAMES, "policy_version": POLICY_VERSION}])

    @gl.public.view
    def get_covenant(self, covenant_id: str) -> str:
        raw = self.covenants.get(covenant_id, None); return _canonical({"found": False, "covenant_id": covenant_id}) if raw is None else _canonical({**json.loads(str(raw)), "found": True})

    def _page(self, table, counts, owner, offset, limit):
        owner = _address(owner); assert offset >= 0 and 0 <= limit <= PAGE_LIMIT; count = int(counts.get(owner, "0")); out = []
        for i in range(offset, min(count, offset + limit)):
            cid = table.get(owner + ":" + str(i), None)
            if cid: out.append(json.loads(str(self.covenants.get(cid))))
        return _canonical({"items": out, "offset": offset, "limit": limit, "total": count})

    @gl.public.view
    def get_covenants_by_creator(self, owner: str, offset: int, limit: int) -> str: return self._page(self.creator_index, self.creator_counts, owner, offset, limit)

    @gl.public.view
    def get_covenants_by_counterparty(self, owner: str, offset: int, limit: int) -> str: return self._page(self.counterparty_index, self.counterparty_counts, owner, offset, limit)

    @gl.public.view
    def get_covenant_evaluations(self, covenant_id: str, offset: int, limit: int) -> str:
        assert self.covenants.get(covenant_id, None) is not None and offset >= 0 and 0 <= limit <= PAGE_LIMIT; c = self._get(covenant_id); out = []
        total = int(c.evaluation_count); retained = min(total, HISTORY_LIMIT)
        for i in range(offset, min(retained, offset + limit)):
            sequence = total - i
            aid = self.covenant_evaluations.get(covenant_id + ":" + str(sequence % HISTORY_LIMIT), None)
            if aid: out.append(json.loads(str(self.attestations[aid])))
        return _canonical({"items": out, "offset": offset, "limit": limit, "total": total, "retained": retained})

    @gl.public.view
    def get_attestation(self, attestation_id: str) -> str:
        raw = self.attestations.get(attestation_id, None); return _canonical({"found": False, "attestation_id": attestation_id}) if raw is None else _canonical({**json.loads(str(raw)), "found": True})

    @gl.public.view
    def get_attestations(self, offset: int, limit: int) -> str:
        assert offset >= 0 and 0 <= limit <= PAGE_LIMIT
        total = int(self.attestation_count); retained = min(total, ATTESTATION_LIMIT); out = []
        for i in range(offset, min(retained, offset + limit)):
            aid = self.attestation_index.get(str((total - 1 - i) % ATTESTATION_LIMIT), None)
            if aid: out.append(json.loads(str(self.attestations[aid])))
        return _canonical({"items": out, "offset": offset, "limit": limit, "total": total, "retained": retained})

    @gl.public.view
    def get_protocol_stats(self) -> str: return _canonical({"protocol_version": "priceguard-covenant-1", "policy_version": POLICY_VERSION, "market_update_count": self.market_update_count, "covenant_count": self.covenant_count, "personal_count": self.personal_count, "bilateral_count": self.bilateral_count, "pending_count": self.pending_count, "active_count": self.active_count, "triggered_count": self.triggered_count, "expired_count": self.expired_count, "canceled_count": self.canceled_count, "closed_count": self.closed_count, "attestation_count": self.attestation_count, "custody": False})
