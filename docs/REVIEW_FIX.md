# Historical review redesign

Deprecated V1 remains preserved for audit history. V2 was redesigned from the
removed custodial vault concept into PriceGuard Covenant: a non-custodial
covenant registry and market-attestation protocol. Payable methods, GEN
balances, liabilities, escrow, claims, refunds, and transfers are absent from
the active contract.

V2 is deployed on Bradbury Testnet at
`0x7B939483E69ada6d2ca37acd3684182Ed141F35F`. A supplied first-market-refresh
reference is retained, but its finality, execution result, resulting record,
matching state read, and identifier type are not preserved in repository evidence.
The full covenant lifecycle remains unverified. Attestations are evidence only;
external systems choose and execute any downstream action independently.
