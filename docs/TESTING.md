# Testing

## Contract

The Direct Mode shim exercises deterministic parsing, leader/validator schema
checks, independent re-fetch comparison, strict three-source covenant
evaluation, lifecycle authorization, counter invariants, deterministic ID
vectors, bounded retained indexes, unbounded owner indexes, and the absence of
custody/transfer behavior.

```bash
PYTHONPYCACHEPREFIX=/private/tmp/priceguard-pycache \
  python3 -m unittest discover -s tests -v
/Users/mralbert/.venvs/genvm-lint/bin/genvm-lint check contracts/priceguard.py
/Users/mralbert/.venvs/genvm-lint/bin/genvm-lint schema contracts/priceguard.py
```

## Frontend

The production-helper suite tests GenLayer transaction finality, AGREE and
MAJORITY_AGREE compatibility, fixed-point formatting, exact shared ID vectors,
create-argument validation, stale hash binding, independent pagination,
authorization windows, strict contract response guards, retained attestation
pagination, activity persistence validation, and responsive/reduced-motion
safeguards. It also checks manual app-session disconnect behavior, explicit
wallet/network controls, EIP-6963 injected-provider selection, covenant creation
navigation, mobile wallet-control containment, and active deployment wording.

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --omit=dev
git diff --check
```

## Remaining external gates

Local unit tests cannot prove browser-wallet behavior, live exchange response
stability, real validator consensus, appeal/finality timing, or Bradbury RPC
availability. Complete route/viewport browser QA, then execute the deployment
and lifecycle checklist in `docs/BRADBURY_DEPLOYMENT.md`.
