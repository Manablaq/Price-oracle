# Testing

PriceGuard uses deterministic Python contract tests, Node frontend tests, static analysis, production builds, documentation-link checks, and manual browser/live-network evidence. Local tests do not replace Bradbury finality or post-finalization state reads.

## Zero-exit local validation

Run from the repository root with the documented environment configured:

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

`npm ci` installs the exact dependency graph from `package-lock.json`. The contract diff must remain empty unless a contract change is explicitly in scope and its deployment consequences are accepted.

## Required dependency review

Run `npm audit --omit=dev` separately and assess its output; do not describe the command as a zero-exit gate while a reviewed advisory remains open. As of 2026-07-13 it exits nonzero with two moderate entries (`next` and its transitive `postcss`) for GHSA-qx2v-qp2m-jg93 through `next@16.2.9 > postcss@8.4.31`. The finding, affected path, and remediation decision are recorded in [Security](SECURITY.md). CI runs the audit with `continue-on-error` so the finding remains visible without being mislabeled as a passing clean audit.

## Contract unit tests

`tests/test_priceguard.py` imports `contracts/priceguard.py` through a Direct Mode-style GenLayer shim. It covers:

- fixed-point parsing, half-up source rounding, threshold precision, and hostile numeric forms;
- exact shared covenant and attestation ID vectors;
- source identity, freshness, raw-payload shape, derived-field recomputation, and canonical ordering;
- 50/51 basis-point leader-validator tolerance boundaries;
- strict three-source covenant evaluation and no-write behavior when consensus fails;
- PERSONAL and BILATERAL creation, duplicate IDs, counterparties, revisions, and expiry bounds;
- successful bilateral acceptance; successful creator cancellation at the inclusive expiry boundary; successful active and pending expiry after expiry; and the resulting protocol counters;
- successful `NOT_SATISFIED` then `SATISFIED` evaluation, exact attestation IDs and sequence, trigger fields, market/attestation counts, and active-to-triggered counters;
- PERSONAL creator acknowledgement and closure, BILATERAL first acknowledgement remaining `TRIGGERED`, BILATERAL second acknowledgement closing, and triggered/closed counters;
- global retained-attestation rollover after the 257th attestation at the 256-ID limit, exact-record persistence after index eviction, unbounded owner indexes, and bounded page behavior; and
- absence of the active V2 custody, payable, transfer, claim, refund, and funded-balance surface.

Run only the Python suite with:

```bash
PYTHONPYCACHEPREFIX=/tmp/priceguard-pycache python3 -m unittest discover -s tests -v
```

## GenVM lint and schema checks

GenVM validation uses the separate [`genvm-linter` package](https://docs.genlayer.com/api-references/genlayer-linter) and requires Python 3.12+. It is not installed by npm and is not pinned in the current repository, so install it explicitly in a contributor-owned virtual environment:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install genvm-linter
```

Use the generic executable or set `GENVM_LINT` to a compatible executable path:

```bash
GENVM_LINT="${GENVM_LINT:-genvm-lint}"
"$GENVM_LINT" check contracts/priceguard.py
"$GENVM_LINT" schema contracts/priceguard.py
```

`check` combines AST safety checks with SDK semantic validation. `schema` must expose the contract's current seven writes and ten views. Review schema output manually against [Integrations](INTEGRATIONS.md); do not commit a generated ABI or change the deployed ABI as part of a documentation-only task.

CI does not report GenVM lint as passing because the tool is not reproducibly pinned in this repository. The CI contract job runs only the Python unittest suite.

## Frontend tests

`npm test` executes production helper and repository guard tests. Coverage includes:

- fixed-point display, deterministic IDs, covenant argument validation, and stale preview binding;
- exact market, covenant, attestation, page, protocol-statistics, and Activity response guards;
- independent creator/counterparty pagination and retained-attestation pagination;
- authorization and time-window parity with the contract;
- GenLayer finality classification, including `AGREE` and `MAJORITY_AGREE` compatibility;
- browser Activity namespacing, validation, merging, and corrupt-record rejection;
- responsive safeguards, reduced-motion support, wallet modal accessibility, focus return, and mobile containment;
- active deployment wording and an empty working-tree diff for `contracts/priceguard.py`.

The test total may change as coverage grows. Use the command result, commit, and date when preserving a count as evidence rather than treating a count as a permanent project property.

## Submission diagnostics and error safety

Frontend tests inspect the staged write pipeline:

1. `PREPARATION`
2. `CLIENT_INITIALIZATION`
3. `NETWORK_VERIFICATION`
4. `WALLET_SUBMISSION`
5. `HASH_VALIDATION`

Unknown thrown values are normalized from a bounded set of message and code fields. Tests cover native errors, strings, nested error/cause objects, circular references, text bounds, stack removal, and redaction of secrets, signatures, bearer tokens, and long raw hexadecimal payloads. The UI exposes the safe stage, message, code, and optional technical details without serializing the raw provider error.

Failed submission keeps controlled covenant form values intact and releases the retry lock. It does not add Activity when no valid transaction hash was returned.

## Injected-provider and network coverage

Repository tests verify:

- standard EIP-6963 request/announcement handling and the EIP-1193 fallback;
- provider UUID/name metadata, safe icon handling, de-duplication, and exact provider selection;
- no use of the nonstandard `window.ethereum.providers` array or WalletConnect;
- app-session disconnect persistence and blocked automatic account hydration until explicit reconnect;
- `wallet_switchEthereumChain` with Bradbury `0x107d`;
- `wallet_addEthereumChain` only after error code `4902`, followed by another explicit switch;
- exact Bradbury GEN, RPC, and explorer metadata;
- absence of MetaMask Snap RPC methods in application code;
- Rabby-compatible client construction with selected provider and account, without normal-write `client.connect()`;
- immediate `eth_chainId` and `eth_accounts` re-verification before `writeContract`; and
- no automatic resubmission.

## Transaction hash, Activity, and finality coverage

A returned hash must match `0x` plus exactly 64 hexadecimal characters. Activity construction and persistence occur only after that validation. Object-wrapped, short, missing, or non-hexadecimal values fail the hash-validation stage.

Finality tests require:

- `ACCEPTED` and `READY_TO_FINALIZE` remain nonterminal confirmation;
- `FINALIZED` plus `FINISHED_WITH_RETURN` is confirmed;
- finalized execution errors are failures;
- canceled, no-majority, disagreement, timeout, and undetermined outcomes are terminal failure categories; and
- unknown polling errors are retryable rather than silently successful.

Supplementary post-state tests exercise an exact matching created covenant, a missing covenant, a malformed contract response, and an unavailable/read failure. They assert that the helper returns only supplementary state evidence, while source integration tests require it to run only after `classifyTransaction` reports `CONFIRMED`; it never changes `phase` or `terminal` and therefore cannot override protocol finality.

## Responsive and accessibility testing

Automated source guards check the 720-pixel responsive breakpoint, reduced-motion behavior, horizontal containment for code and IDs, 42-pixel wallet controls, modal viewport bounds, dialog semantics, Escape handling, focus trapping/return, accessible status/error regions, and account-menu keyboard navigation.

These checks do not replace rendering and assistive-technology testing. Manually verify at minimum:

- narrow mobile, tablet, and wide desktop viewports;
- 200% browser zoom and keyboard-only navigation;
- visible focus, logical focus order, modal containment, Escape, and focus return;
- reduced-motion preference;
- long addresses, transaction hashes, covenant IDs, attestation IDs, and JSON;
- screen-reader names for wallet, menu, dialog, status, and error controls; and
- sufficient contrast for normal, warning, danger, disabled, and focus states.

## Browser manual QA

Test every active route: `/`, `/markets`, `/covenants`, `/covenants/new`, `/covenants/[id]`, `/attestations`, `/attestations/[id]`, `/activity`, `/integrations`, and `/about/verification`. Confirm historical `/vaults` redirects.

Exercise these states without using real secrets:

- no injected wallet, one wallet, and multiple EIP-6963 wallets;
- connect approval, user rejection, already-pending wallet request, and provider disappearance;
- app disconnect, reload while manually disconnected, and explicit reconnect;
- correct network, wrong network, unknown Bradbury network (`4902`), unsupported switch, and declined switch;
- account change before submission and chain change before submission;
- read loading, empty, not-found, malformed, RPC-error, and retry states;
- valid and invalid covenant inputs for both modes and every condition;
- staged submission errors, valid hash Activity creation, polling, terminal classification, and state-read result; and
- page navigation at retained-index boundaries.

Use disposable Bradbury accounts and testnet GEN for fees. Never paste a private key or seed phrase into the application, test output, issue, or pull request.

## Live Bradbury lifecycle evidence

Local tests cannot prove live venue availability, real validator consensus, appeal/finality timing, wallet-extension behavior, Bradbury RPC availability, or post-finalization contract state. Preserve a structured evidence row for every live write with transaction ID when available, chain transaction hash, final status, execution result, resulting record ID, state read, and verification date.

For each operation:

1. submit once and retain the returned hash;
2. wait for `FINALIZED`;
3. require `FINISHED_WITH_RETURN`;
4. read and validate the expected market, covenant, or attestation state; and
5. record evidence without exposing wallet secrets or raw provider payloads.

An `ACCEPTED` covenant creation is awaiting finalization and is not verified. Do not mark covenant creation or the complete lifecycle verified until the finality and state-read requirements are met. See [Bradbury deployment](BRADBURY_DEPLOYMENT.md).
