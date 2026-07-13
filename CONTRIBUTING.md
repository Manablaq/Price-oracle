# Contributing to PriceGuard Covenant

Contributions should preserve the narrow BTC/USD policy, non-custodial boundary, exact schema, wallet semantics, and explicit GenLayer finality model unless the repository owner has approved a broader contract change.

## Setup

Prerequisites are Node.js 22.6.0 or newer, npm, and Python 3.12+ for contract tooling.

```bash
git clone https://github.com/Manablaq/Price-oracle.git
cd Price-oracle
cp .env.example .env.local
npm ci
npm run dev
```

The public contract address is safe in `.env.local`; secrets are not. See [Testing](docs/TESTING.md) for optional GenVM linter installation.

## Branch naming

Create a focused branch from the current default branch. Use a short lowercase prefix and hyphenated summary:

- `feat/<summary>` for user-visible capability;
- `fix/<summary>` for a defect;
- `docs/<summary>` for documentation-only work;
- `test/<summary>` for test coverage; or
- `chore/<summary>` for maintenance.

Do not mix unrelated refactors, documentation changes, dependency updates, and contract changes in one pull request.

## Coding standards

- Follow the existing TypeScript, React, Python, and ESLint conventions.
- Keep TypeScript strict and validate untrusted RPC, wallet, storage, and contract data at runtime.
- Use integer fixed-point arithmetic for protocol price and threshold logic.
- Preserve canonical IDs, JSON fields, enum values, source order, and pagination semantics.
- Keep wallet requests on the selected injected EIP-1193 provider.
- Maintain keyboard, focus, reduced-motion, mobile, and long-content behavior.
- Prefer bounded safe diagnostics; never serialize arbitrary provider errors or sensitive payloads.
- Read the installed Next.js guidance in `node_modules/next/dist/docs/` before changing Next.js code or conventions.

## Required test gate

Before opening a pull request, run:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run docs:check-links
PYTHONPYCACHEPREFIX=/tmp/priceguard-pycache python3 -m unittest discover -s tests -v
git diff --check
git diff -- contracts/priceguard.py contracts/price_oracle.py
```

Also run `npm audit --omit=dev` as a required dependency review and assess every finding against [Security](docs/SECURITY.md). The documented moderate Next.js/PostCSS advisory currently makes a nonzero audit exit expected; do not report it as a passing clean audit. Include the exact commands and results in the pull request. Complete browser QA when UI, wallet, network, Activity, responsiveness, or accessibility can change.

## Contract changes

Changes to `contracts/priceguard.py`, its public methods, schema, consensus policy, storage, IDs, lifecycle, authorization, finality assumptions, or non-custodial boundary require explicit owner review before implementation or deployment.

A contract-change pull request must:

1. explain the threat model and intended behavior;
2. add deterministic boundary and regression tests;
3. run `genvm-lint check` and `genvm-lint schema` with the installed tool;
4. document every ABI, storage, integration, and migration impact;
5. update source hashes and deployment records only after a real deployment is separately authorized and verified; and
6. never relabel the active address as containing un-deployed source changes.

Do not modify deprecated V1 evidence to make it appear equivalent to V2.

## Secrets and keys

Never commit or paste:

- private keys or wallet exports;
- seed or recovery phrases;
- bearer, API, CI, or deployment tokens;
- signatures or raw signed transactions;
- unredacted provider payloads; or
- local `.env` files other than the public `.env.example` template.

If a secret is exposed, stop using it and coordinate rotation with the owner. Removing it from the latest diff is not sufficient once it has entered shared history.

## Deployment policy

Pull requests and CI must not deploy contracts or the production frontend. A merge does not authorize deployment. Production and Bradbury deployment actions require a separate owner decision, explicit environment review, and preserved evidence.

Do not add private keys, deploy tokens, or broad write permissions to GitHub Actions. Repository CI uses read-only contents permission.

## Finality expectations

A transaction hash or `ACCEPTED` status is not success. Live evidence requires `FINALIZED`, `FINISHED_WITH_RETURN`, the resulting record ID when applicable, and a matching contract state read. Preserve transaction and state evidence without exposing secrets.

Never automatically resubmit a delayed or unknown transaction. Do not claim complete lifecycle verification until every required operation has final and state-read evidence.

## Documentation requirements

Update documentation in the same pull request when behavior, commands, dependencies, configuration, wallet/network support, schemas, storage, pagination, security boundaries, deployment identity, or verification status changes.

- Keep active V2 documentation separate from deprecated V1 and vault history.
- Use portable repository-relative commands and paths.
- Validate internal Markdown links with `npm run docs:check-links`.
- Mark illustrative data as illustrative and live evidence with its date and commit.
- Do not state a permanent test count; tie counts to a dated commit when they are useful evidence.
- Do not choose or imply a software license without a matching owner-approved `LICENSE` file.

Use the pull-request template and complete every applicable security, browser, contract, deployment, and documentation section.
