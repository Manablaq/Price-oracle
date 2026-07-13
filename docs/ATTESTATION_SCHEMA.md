# Attestation schema

Attestations use schema version `priceguard-attestation-1` and contain the exact
attestation ID, covenant ID, evaluation sequence, outcome, symbol, condition,
thresholds, evaluated fixed-point price, decimals, market snapshot sequence,
three source identities, source count, min/max observation, spread, confidence,
breaker flag, policy version, evaluation time, and evaluator address.

They are market evidence only. They do not claim payment, custody, legal
enforcement, or external execution.

Exact attestation records grow monotonically and remain addressable by ID. The
global retained index stores only the newest 256 attestation IDs, and each
covenant retained index stores only its newest 32 evaluation IDs. Pagination and
iteration are bounded; total exact-record storage is not bounded. Integrators
must persist IDs they rely on rather than assuming old IDs remain discoverable
through retained indexes.
