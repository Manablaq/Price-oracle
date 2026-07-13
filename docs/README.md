# PriceGuard documentation

This index separates active PriceGuard Covenant V2 documentation from preserved historical material. The active deployment is on GenLayer Bradbury Testnet at `0x7B939483E69ada6d2ca37acd3684182Ed141F35F`.

## Protocol and implementation

- [Architecture](ARCHITECTURE.md) — frontend, clients, consensus, storage, finality, and trust boundaries.
- [Price verification](PRICE_VERIFICATION.md) — source allowlist, fixed-point arithmetic, leader/validator policy, and market storage.
- [Covenant state machine](COVENANT_STATE_MACHINE.md) — modes, authorization, time rules, transitions, and terminal states.
- [Attestation schema](ATTESTATION_SCHEMA.md) — exact certificate fields, scaling, IDs, retention, and verification.
- [Wallet and network](WALLET_AND_NETWORK.md) — injected-provider selection, Bradbury switching, Rabby and MetaMask compatibility, and safe errors.
- [Integrations](INTEGRATIONS.md) — exact public views, typed responses, verification checklists, pagination, and failure handling.

## Assurance and operations

- [Testing](TESTING.md) — local gates, browser QA, GenVM checks, and live lifecycle evidence requirements.
- [Bradbury deployment](BRADBURY_DEPLOYMENT.md) — deployment identity, evidence table, and remaining lifecycle verification.
- [Security](SECURITY.md) — non-custodial boundary, consensus assumptions, frontend semantics, and residual risk.

## Historical and deprecated material

- [V1 review findings](V1_REVIEW_FINDINGS.md) — detailed historical analysis of deprecated V1. It is not PriceGuard V2.
- [Review redesign record](REVIEW_FIX.md) — why the active protocol replaced the prior design.
- [Removed vault history](VAULT_STATE_MACHINE.md) — deprecated design context and redirect behavior only.

Historical documents may contain V1 method names, symbols, addresses, and design terminology that are intentionally preserved as audit evidence. They must not be used to describe the active V2 contract.
