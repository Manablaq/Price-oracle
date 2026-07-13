import importlib.util, json, sys, types, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VECTORS = json.loads((ROOT / "tests/fixtures/id_vectors.json").read_text())

class M(dict):
    @classmethod
    def __class_getitem__(cls, item): return cls
class P:
    def __call__(self, f): return f
    @property
    def payable(self): return self
class Public:
    write = P()
    @staticmethod
    def view(f): return f
class Msg:
    sender_address = "0x1111111111111111111111111111111111111111"
class R:
    def __init__(self, calldata): self.calldata = calldata
class GL:
    Contract = object; public = Public(); message = Msg(); message_raw = {"datetime":"2026-07-13T12:00:00Z"}; result = ""
    class VM:
        Return = R
        @staticmethod
        def run_nondet_unsafe(a, b): return GL.result
    vm = VM()
fake = types.ModuleType("genlayer"); fake.gl = GL; fake.TreeMap = M; fake.DynArray = list; fake.Array = list; fake.allow_storage = lambda x:x; fake.Address = str; fake.u256 = int; fake.__all__ = ["gl","TreeMap","DynArray","Array","allow_storage","Address","u256"]
sys.modules["genlayer"] = fake
spec = importlib.util.spec_from_file_location("pg", ROOT / "contracts/priceguard.py"); pg = importlib.util.module_from_spec(spec); spec.loader.exec_module(pg)

def obs(prices=(6280000,6281000,6282000), ts=1783944000):
    return [{"source":s,"ok":True,"price":str(p),"observed_at":str(ts)} for s,p in zip(["bitstamp","coinbase","gemini"], prices)]
def leader(items):
    return pg._canonical({"symbol":"BTC/USD","asset_class":pg.ASSET_CLASS,"decimals":2,"policy_version":pg.POLICY_VERSION,"raw_observations":items,**pg._derive(items,1783944000)})

def contract():
    c=pg.PriceGuard()
    for n in ["markets","market_history","market_counts","market_starts","covenants","creator_index","counterparty_index","creator_counts","counterparty_counts","attestations","covenant_evaluations","attestation_index"]: setattr(c,n,M())
    return c

class CovenantTests(unittest.TestCase):
    def test_fixed_point_and_ids(self):
        self.assertEqual(pg._parse_decimal("62831.71"), 6283171)
        self.assertEqual(pg._id("0xAA", "req-1"), pg._id("0xaa", "req-1"))
        self.assertNotEqual(pg._id("0xaa", "req-1"), pg._id("0xaa", "req-2"))
    def test_fixed_hash_vectors_and_lengths(self):
        for vector in VECTORS:
            cid = pg._id(vector["creator"], vector["request"])
            self.assertEqual(cid, vector["covenant_id"]); self.assertEqual(len(cid), 52)
            for sequence, expected in vector["attestations"].items():
                aid = pg._attestation_id(cid, sequence); self.assertEqual(aid, expected); self.assertEqual(len(aid), 52)
    def test_oracle_rejects_malformed_and_two_source_not_high(self):
        with self.assertRaises(AssertionError): pg._derive([{**x,"ok":False} for x in obs()],1783944000)
        items=obs(); items[0]["ok"]=False; d=pg._derive(items,1783944000); self.assertNotEqual(d["confidence"],"HIGH")
    def test_leader_integrity_and_tolerance(self):
        good=obs(); old=pg._fetch_observations; pg._fetch_observations=lambda:good
        try:
            forged=json.loads(leader(good)); forged["median_price"]="1"; self.assertFalse(pg._validate_leader(R(pg._canonical(forged)),"BTC/USD",1783944000))
        finally: pg._fetch_observations=old
    def test_honest_validator_acceptance_and_canonical_order(self):
        honest = obs(); old = pg._fetch_observations; pg._fetch_observations = lambda: list(reversed(honest))
        try:
            self.assertTrue(pg._validate_leader(R(leader(honest)), "BTC/USD", 1783944000))
        finally: pg._fetch_observations = old
    def test_small_drift_and_tolerance_boundaries(self):
        honest = obs(); old = pg._fetch_observations
        try:
            pg._fetch_observations = lambda: obs((6283000,6284000,6285000))
            self.assertTrue(pg._validate_leader(R(leader(honest)), "BTC/USD", 1783944000))
            pg._fetch_observations = lambda: obs((6315000,6316000,6317000))
            self.assertFalse(pg._validate_leader(R(leader(honest)), "BTC/USD", 1783944000))
        finally: pg._fetch_observations = old
    def test_timestamp_window_and_numeric_rejections(self):
        for ts in [1783944040, 1783943000, 1783944000000]:
            with self.subTest(ts=ts), self.assertRaises(AssertionError): pg._derive(obs(ts=ts),1783944000)
        for value in ["+1", "-1", "0", "1e3", "1.123456789"]:
            x=obs(); x[0]["price"]=value
            with self.subTest(value=value), self.assertRaises(Exception): pg._derive(x,1783944000)
    def test_source_identity_and_shape_attacks(self):
        x=obs(); x[0]["source"]="coinbase"
        with self.assertRaises(AssertionError): pg._derive(x,1783944000)
        forged=json.loads(leader(obs())); forged["spread_bps"]=0
        old=pg._fetch_observations; pg._fetch_observations=lambda:obs()
        try: self.assertFalse(pg._validate_leader(R(pg._canonical(forged)),"BTC/USD",1783944000))
        finally: pg._fetch_observations=old
    def test_exact_50_and_51_bps_boundaries(self):
        honest = obs((1000000,1000000,1000000)); old = pg._fetch_observations
        try:
            pg._fetch_observations = lambda: obs((1005000,1005000,1005000))
            self.assertTrue(pg._validate_leader(R(leader(honest)), "BTC/USD", 1783944000))
            pg._fetch_observations = lambda: obs((1005100,1005100,1005100))
            self.assertFalse(pg._validate_leader(R(leader(honest)), "BTC/USD", 1783944000))
        finally: pg._fetch_observations=old
    def test_strict_validator_rejects_two_sources(self):
        honest = obs(); degraded = list(honest); degraded[0] = {**degraded[0], "ok": False}
        old = pg._fetch_observations; pg._fetch_observations = lambda: degraded
        try:
            self.assertFalse(pg._validate_leader(R(leader(honest)), "BTC/USD", 1783944000, require_all=True))
        finally: pg._fetch_observations = old
    def test_failed_strict_evaluation_writes_nothing(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        cid=c.create_covenant("strict_fail","PERSONAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","70000","",0,1783947600,"HIGH",100,"","","")
        before=(dict(c.markets),dict(c.covenants),dict(c.attestations),dict(c.covenant_evaluations),c.attestation_count,c.market_update_count)
        old=GL.vm.run_nondet_unsafe
        GL.vm.run_nondet_unsafe=lambda leader, validator: (_ for _ in ()).throw(AssertionError("no consensus"))
        try:
            with self.assertRaises(AssertionError): c.evaluate_covenant(cid)
        finally: GL.vm.run_nondet_unsafe=old
        after=(dict(c.markets),dict(c.covenants),dict(c.attestations),dict(c.covenant_evaluations),c.attestation_count,c.market_update_count)
        self.assertEqual(before,after)
    def test_threshold_parser_preserves_two_decimals(self):
        self.assertEqual(pg._parse_threshold("12.30"), 1230)
        for value in ["12.345", "+1", "-1", "1e2", "0", "1234567890123"]:
            with self.subTest(value=value), self.assertRaises(AssertionError): pg._parse_threshold(value)
    def test_no_custody_surface(self):
        source=(ROOT/"contracts/priceguard.py").read_text()
        for forbidden in ["gl.message.value","emit_transfer","reserved_liabilities","claim_triggered","refund_expired","funded_amount"]: self.assertNotIn(forbidden, source)
    def test_schema_lifecycle_names(self):
        for name in ["create_covenant","accept_covenant","cancel_unaccepted_covenant","evaluate_covenant","expire_covenant","acknowledge_outcome"]: self.assertTrue(hasattr(pg.PriceGuard,name))
    def test_no_payable_or_transfer_surface(self):
        for name in dir(pg.PriceGuard): self.assertNotIn("payable", name.lower())
    def test_personal_and_bilateral_ids_and_duplicates(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        args=("req_1","PERSONAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","70000","",0,1783947600,"HIGH",100,"memo","","")
        cid=c.create_covenant(*args); self.assertEqual(json.loads(c.get_covenant(cid))["status"],"ACTIVE")
        with self.assertRaises(AssertionError): c.create_covenant(*args)
        bid=c.create_covenant("req_2","BILATERAL","0x2222222222222222222222222222222222222222","BTC/USD","ABOVE","1","",0,1783947600,"HIGH",100,"","","")
        self.assertEqual(json.loads(c.get_covenant(bid))["status"],"PENDING_ACCEPTANCE")
    def test_bilateral_accept_cancel_authorization(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        cid=c.create_covenant("req_3","BILATERAL","0x2222222222222222222222222222222222222222","BTC/USD","ABOVE","1","",0,1783947600,"HIGH",100,"","","")
        with self.assertRaises(AssertionError): c.accept_covenant(cid)
        GL.message.sender_address="0x2222222222222222222222222222222222222222"; c.accept_covenant(cid)
        self.assertEqual(json.loads(c.get_covenant(cid))["status"],"ACTIVE")
        GL.message.sender_address="0x1111111111111111111111111111111111111111"
        with self.assertRaises(AssertionError): c.cancel_unaccepted_covenant(cid)
    def test_attestation_index_pagination_is_not_hard_coded(self):
        c=contract(); c.attestation_index["0"]="att_x"; c.attestation_count="1"; c.attestations["att_x"]='{"attestation_id":"att_x"}'
        page=json.loads(c.get_attestations(0,10)); self.assertEqual(page["total"],1); self.assertEqual(page["items"][0]["attestation_id"],"att_x")

    def test_owner_indexes_are_not_artificially_capped(self):
        c = contract()
        owner = "0x1111111111111111111111111111111111111111"
        for index in range(300):
            c._index(c.creator_index, c.creator_counts, owner, f"cov_{index}")
        self.assertEqual(c.creator_counts[owner], "300")
        self.assertEqual(c.creator_index[owner + ":299"], "cov_299")

    def test_counter_invariant_helper(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        cid=c.create_covenant("req_counter","BILATERAL","0x2222222222222222222222222222222222222222","BTC/USD","BELOW","70000","",0,1783947600,"HIGH",100,"","","")
        pg._assert_counter_invariant(c)
        GL.message.sender_address="0x2222222222222222222222222222222222222222"; c.accept_covenant(cid); pg._assert_counter_invariant(c)

    def test_personal_counterparty_must_be_zero(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        with self.assertRaises(AssertionError): c.create_covenant("personal_bad","PERSONAL","0x2222222222222222222222222222222222222222","BTC/USD","BELOW","1","",0,1783947600,"HIGH",100,"","","")
    def test_external_reference_canonical_lowercase(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        with self.assertRaises(AssertionError): c.create_covenant("hash_bad","PERSONAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","1","",0,1783947600,"HIGH",100,"","0x"+"A"*64,"")
    def test_revision_requires_existing_same_creator(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        with self.assertRaises(AssertionError): c.create_covenant("revision_bad","PERSONAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","1","",0,1783947600,"HIGH",100,"","","missing")
    def test_bilateral_zero_and_creator_counterparty_rejected(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        with self.assertRaises(AssertionError): c.create_covenant("bilateral_zero","BILATERAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","1","",0,1783947600,"HIGH",100,"","","")
        with self.assertRaises(AssertionError): c.create_covenant("bilateral_self","BILATERAL",GL.message.sender_address,"BTC/USD","BELOW","1","",0,1783947600,"HIGH",100,"","","")
    def test_expiry_is_strictly_future_and_bounded(self):
        c=contract(); GL.message.sender_address="0x1111111111111111111111111111111111111111"
        with self.assertRaises(AssertionError): c.create_covenant("expiry_now","PERSONAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","1","",0,1783944000,"HIGH",100,"","","")
        with self.assertRaises(AssertionError): c.create_covenant("expiry_far","PERSONAL",pg.ZERO_ADDRESS,"BTC/USD","BELOW","1","",0,1783944000+pg.MAX_VALIDITY_SECONDS+1,"HIGH",100,"","","")
    def test_threshold_requires_range_upper_bound(self):
        with self.assertRaises(AssertionError): pg._parse_threshold("")

for _name, _value in {
    "above": ("ABOVE", 101, 100, 0), "below": ("BELOW", 99, 100, 0),
    "at_or_above": ("AT_OR_ABOVE", 100, 100, 0), "at_or_below": ("AT_OR_BELOW", 100, 100, 0),
    "in_range_low": ("IN_RANGE", 100, 100, 200), "in_range_high": ("IN_RANGE", 200, 100, 200),
}.items():
    def _make(n, value):
        def test(self): self.assertTrue(pg._condition(*value))
        test.__name__ = "test_condition_" + n
        return test
    setattr(CovenantTests, "test_condition_" + _name, _make(_name, _value))

for _name, _value in {
    "leading_zero_price":"001", "leading_zero_time":"01783944000", "plus":"+1", "minus":"-1", "zero":"0", "exponent":"1e2", "too_precise":"1.234", "empty":"", "decimal_sign":"+0.1", "negative_decimal":"-0.1"
}.items():
    def _numeric_test(n, value):
        def test(self):
            items = obs(); items[0]["price"] = value
            with self.assertRaises(Exception): pg._derive(items, 1783944000)
        test.__name__ = "test_numeric_attack_" + n
        return test
    setattr(CovenantTests, "test_numeric_attack_" + _name, _numeric_test(_name, _value))

if __name__ == "__main__": unittest.main()
