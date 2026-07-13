# Integrations

External agents should read `get_attestation(attestation_id)` and verify the
schema version, covenant ID, outcome, policy version, source summary, timestamp,
and contract network/address. PriceGuard is an evidence registry, not an
executor. Integrators must independently decide whether an attestation should
change treasury, FX, insurance, supplier, DAO, or agent state.
