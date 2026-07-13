# PriceGuard Covenant

PriceGuard Covenant V2 is a non-custodial BTC/USD market-covenant and attestation protocol on GenLayer Bradbury Testnet. It independently observes three fixed spot-market sources, records consensus-verified market evidence, and evaluates user-authored conditions without holding or transferring funds.

- Live application: [price-oracle-delta.vercel.app](https://price-oracle-delta.vercel.app)
- Network: GenLayer Bradbury Testnet, chain ID `4221` (`0x107d`)
- Contract: [`0x7B939483E69ada6d2ca37acd3684182Ed141F35F`](https://explorer-bradbury.genlayer.com/address/0x7B939483E69ada6d2ca37acd3684182Ed141F35F)
- Policy: `BTCUSD-1`, symbol `BTC/USD`, two decimal places

## Verification status

The V2 deployment identity is recorded. The repository preserves a reference for the first market refresh but not enough evidence to prove its final status, execution result, resulting market sequence, matching state read, or whether the reference is a GenLayer transaction identifier or a separate chain transaction hash. A PERSONAL covenant creation transaction has reached `ACCEPTED`, which is nonterminal and is still awaiting finalization. Covenant creation must not be called verified until the transaction is `FINALIZED` with `FINISHED_WITH_RETURN` and the resulting covenant is confirmed by a state read. The complete create, evaluate, trigger or expire, acknowledge, and close lifecycle remains unverified.

Bradbury is a test network. The recorded deployment does not make this software production-safe.

## Non-custodial boundary

PriceGuard records market snapshots, covenant state, and attestations only. The active V2 contract has no payable method, GEN balance accounting, transfer, claim, refund, settlement, or external-execution path. A covenant is evidence and coordination state—not a payment, escrow, or custody arrangement.

## Protocol features

- Fixed `BTC/USD` policy with Coinbase Exchange, Bitstamp, and Gemini sources.
- Deterministic integer-cent parsing, median, dispersion, confidence, and circuit-breaker rules.
- Independent validator re-fetch and recomputation of leader-derived fields.
- PERSONAL and BILATERAL covenants with deterministic IDs and explicit authorization.
- Exact attestation records with bounded discovery indexes and bounded pagination.
- Strict frontend response guards for contract JSON.
- Injected-wallet discovery through EIP-6963, with an EIP-1193 fallback.
- Explicit Bradbury switch/add flow, selected-provider writes, and no automatic resubmission.
- GenLayer finality polling plus supplementary post-finalization state reads.
- Browser-local Activity persistence only after a valid transaction hash is returned.

## Architecture

The Next.js frontend reads Bradbury state with a read-only GenLayer client. Writes use the exact injected provider selected in the wallet dialog and a GenLayer client constructed with that provider and account. Immediately before `writeContract`, the frontend re-verifies chain `4221` and the active account.

The contract is the consensus and storage boundary. A leader fetches all fixed venue endpoints; validators validate the exact payload, recompute every derived field, and independently fetch the same venues. Only consensus-returned data is stored. The frontend cannot supply endpoints, source identities, or market values.

See [Architecture](docs/ARCHITECTURE.md) for the complete read, write, storage, finality, and trust-boundary model.

## Three-source BTC/USD verification

Source prices are parsed as unsigned decimals and deterministically rounded to integer cents. Observations must be no more than 120 seconds old and no more than 30 seconds in the future. The policy rejects malformed or duplicate sources, excludes a three-source outlier more than 100 basis points from the preliminary median, and calculates an integer median and spread.

A manual market refresh needs at least two accepted sources and no circuit breaker. Covenant evaluation is stricter: all three sources, `HIGH` confidence, no circuit breaker, and the covenant's own spread cap are required. Validator and leader medians must remain within 50 basis points. See [Price verification](docs/PRICE_VERIFICATION.md).

## Covenant lifecycle

PERSONAL covenants begin `ACTIVE`. BILATERAL covenants begin `PENDING_ACCEPTANCE` and become `ACTIVE` only when the named counterparty accepts on or before expiry. Anyone may evaluate an active covenant during its validity window. Each successful evaluation records an attestation; an unsatisfied result remains `ACTIVE`, while a satisfied result becomes `TRIGGERED`.

Untriggered active or pending covenants can become `EXPIRED` after expiry. The creator may cancel an unaccepted bilateral covenant on or before expiry. A triggered PERSONAL covenant closes after creator acknowledgement; a triggered BILATERAL covenant closes after both named parties acknowledge. Terms are not edited in place. See [Covenant state machine](docs/COVENANT_STATE_MACHINE.md).

## Wallet compatibility

The application supports injected EIP-1193 wallets only. It does not include WalletConnect. EIP-6963 announcements provide provider UUID, name, icon, and reverse-domain metadata; a user selection resolves back to that exact provider for connection and writes. Rabby-compatible writes construct the client directly with the selected provider and account. Normal writes do not call GenLayerJS `client.connect()` and do not invoke MetaMask Snap RPC methods.

Disconnecting from PriceGuard ends the application session and persists that choice locally. It does not revoke the site's authorization inside the wallet extension. See [Wallet and network](docs/WALLET_AND_NETWORK.md).

## Transaction finality

`ACCEPTED` and `READY_TO_FINALIZE` are nonterminal. Success requires both `FINALIZED` and `FINISHED_WITH_RETURN`. Cancellation, timeouts, undetermined consensus, and execution failure are distinct terminal outcomes. Unknown polling errors remain retryable.

After successful finalization, the frontend performs a supplementary contract read. That read can confirm the expected record is currently readable, but it does not override protocol finality and may observe state changed by a later transaction. PriceGuard never automatically resubmits a write.

## Quick start

Prerequisites are Node.js `22.6.0` or newer, npm, and Python 3.12+ for the contract tooling documented below.

```bash
git clone https://github.com/Manablaq/Price-oracle.git
cd Price-oracle
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000` for local development. The production application remains the Vercel URL listed above.

## Environment configuration

The frontend has one public configuration value:

```text
NEXT_PUBLIC_PRICEGUARD_V2_ADDRESS=0x7B939483E69ada6d2ca37acd3684182Ed141F35F
```

Copy [.env.example](.env.example) to `.env.local`. Variables prefixed with `NEXT_PUBLIC_` are embedded into the browser bundle and must never contain secrets. Do not commit `.env.local`, tokens, private keys, seed phrases, or signed transaction payloads.

## Repository structure

```text
app/                 Next.js routes, layouts, styles, and protocol API route
components/          Market, covenant, wallet, activity, and write UI
contracts/           Active V2 contract and preserved historical V1 source
docs/                Protocol, integration, deployment, security, and test records
lib/                 Network config, contract guards, IDs, finality, and errors
scripts/             Repository documentation checks
tests/               Python contract tests, frontend tests, and shared ID vectors
types/               Injected EIP-1193 provider declarations
.github/              CI workflow and pull-request template
```

`contracts/priceguard.py` is the active V2 source. `contracts/price_oracle.py` is deprecated V1 retained for audit history. Historical `/vaults` routes redirect to the covenant interface; the removed design is documented separately.

## Development and verification commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run docs:check-links
PYTHONPYCACHEPREFIX=/tmp/priceguard-pycache python3 -m unittest discover -s tests -v
git diff --check
```

Run `npm audit --omit=dev` separately as a required dependency review. The currently documented moderate Next.js/PostCSS advisory makes a nonzero exit expected; assess and record it as described in [Security](docs/SECURITY.md), rather than reporting a clean audit.

### GenVM lint and schema setup

GenVM checks require the separate [`genvm-linter` Python tool](https://docs.genlayer.com/api-references/genlayer-linter). Install it in a contributor-owned virtual environment; it is not currently pinned in this repository or installed by `npm ci`.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install genvm-linter
```

Then run the generic executable, or override it with a compatible executable path:

```bash
GENVM_LINT="${GENVM_LINT:-genvm-lint}"
"$GENVM_LINT" check contracts/priceguard.py
"$GENVM_LINT" schema contracts/priceguard.py
```

The CI contract job runs the repository's Python unittest suite but intentionally does not claim to run GenVM checks until the linter is reproducibly pinned for CI.

## Deployment evidence

| Evidence | Value |
| --- | --- |
| Deployment transaction | [`0x0bec3ce3653dab8e1135bf2a2b547816905c132d78dabfc1f998f898c3f6bf69`](https://explorer-bradbury.genlayer.com/tx/0x0bec3ce3653dab8e1135bf2a2b547816905c132d78dabfc1f998f898c3f6bf69) |
| Supplied first-market-refresh reference (identifier type and lifecycle evidence not preserved) | `0x7516d2370b7067d1cfbde1ee8ec21ca0294e85f3902ac2c0b9c702f5aba6b313` |
| Contract source SHA-256 | `bdd0fac72f9659d76e03c04c60d55f1be4a46127da691fa9265cc77bd10b125a` |
| Deployment source commit | `645e49a73e32cc0fdb12fda459d0fc7fa3b4d8f9` |
| Audit working-code commit | `13f096e` |

See [Bradbury deployment](docs/BRADBURY_DEPLOYMENT.md) for lifecycle evidence requirements. Do not infer refresh or lifecycle verification from these records.

## Documentation

The [documentation index](docs/README.md) routes readers to architecture, wallet/network behavior, integrations, schemas, state transitions, testing, deployment, security, and historical records.

## Security and limitations

PriceGuard reduces reliance on one HTTP response; it does not eliminate venue manipulation, correlated sources, shared infrastructure, API outages, validator disagreement, RPC failure, chain reorganization or testnet risk, policy error, frontend compromise, or contract defects. Retained discovery indexes are bounded even though exact covenant and attestation records remain addressable by ID. Integrators must persist exact IDs and independently define authorization, replay protection, consequences, and failure handling.

Review [Security](docs/SECURITY.md) before integrating or testing live writes. Never treat an attestation as a payment receipt, custody proof, legal judgment, or automatic external action.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), create a focused branch, preserve the test gate, and document any contract, schema, deployment, finality, wallet, or security impact. Pull requests must not deploy contracts or applications and must not include secrets or private keys.

## License

No `LICENSE` file exists. The repository owner must choose and add a license before redistribution terms can be stated. No license is implied by the package metadata or this README.
