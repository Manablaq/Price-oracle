# PriceGuard Covenant

PriceGuard Covenant is a deployed, non-custodial GenLayer Bradbury Testnet protocol for
independently verified BTC/USD market covenants and evidence attestations. It
records market evidence and covenant state only. The V2 contract has no payable
method, balance accounting, transfer, claim, refund, or settlement path.

## Why GenLayer

The leader fetches three fixed exchange endpoints. Validators independently
fetch the same venues, recompute fixed-point median and dispersion, and reject a
leader result that does not match the declared policy. Contract storage changes
happen only after nondeterministic consensus returns.

## V1 versus V2

The reviewer-rejected V1 source remains unchanged in
`contracts/price_oracle.py`. Its historical Bradbury address is
`0x3bfa3494C7AEB35489436A5325DD0D8F51BE5E0B`. V1 performed shape-oriented
validation and must not be described as PriceGuard V2.

V2 is `contracts/priceguard.py`. The active Bradbury deployment is
`0x7B939483E69ada6d2ca37acd3684182Ed141F35F` on chain 4221.

## Covenant lifecycle

1. Create a PERSONAL or BILATERAL covenant with a deterministic ID.
2. The named bilateral counterparty accepts before expiry.
3. Anyone may evaluate an ACTIVE covenant inside its validity window.
4. Evaluation requires all three configured sources, HIGH confidence, no
   circuit breaker, and the covenant spread limit.
5. Every evaluation creates an exact attestation. A satisfied result moves the
   covenant to TRIGGERED.
6. PERSONAL covenants close after creator acknowledgement. BILATERAL covenants
   close after both named parties acknowledge.
7. External systems decide how to use the evidence; PriceGuard executes no
   external action.

## Transaction handling

The frontend follows the GenLayerJS finality model:

- `ACCEPTED` and `READY_TO_FINALIZE` remain nonterminal.
- A transaction is successful only at `FINALIZED` with
  `FINISHED_WITH_RETURN`.
- `FINISHED_WITH_ERROR`, cancellation, timeout, and undetermined consensus are
  displayed separately.
- Post-finalization contract reads are supplementary UX checks. They never
  override the protocol execution result, because later valid transactions may
  already have advanced the same covenant.
- Writes are never automatically resubmitted.

## Storage and pagination

Exact covenant and attestation records are addressable by ID. The global
attestation discovery ring retains 256 IDs, each covenant evaluation ring
retains 32 IDs, and every public page is bounded to 50 items. Creator and
counterparty indexes grow without an artificial per-wallet record cap.

## Active routes

`/`, `/markets`, `/covenants`, `/covenants/new`, `/covenants/[id]`,
`/attestations`, `/attestations/[id]`, `/activity`, `/integrations`, and
`/about/verification`. Historical `/vaults` URLs only redirect to covenants.

## Current status

The active V2 contract was deployed from commit
`645e49a73e32cc0fdb12fda459d0fc7fa3b4d8f9`; the deployed source SHA-256 is
`bdd0fac72f9659d76e03c04c60d55f1be4a46127da691fa9265cc77bd10b125a`.
Deployment transaction:
`0x0bec3ce3653dab8e1135bf2a2b547816905c132d78dabfc1f998f898c3f6bf69`.

One market update is verified. Its first successful refresh transaction is
`0x7516d2370b7067d1cfbde1ee8ec21ca0294e85f3902ac2c0b9c702f5aba6b313`.
The production frontend is <https://price-oracle-delta.vercel.app>. PriceGuard
remains non-custodial. The full create/evaluate/expire/acknowledge covenant
lifecycle has not yet been verified on Bradbury and must not be described as
complete.

## Verification

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
PYTHONPYCACHEPREFIX=/private/tmp/priceguard-pycache \
  python3 -m unittest discover -s tests -v
/Users/mralbert/.venvs/genvm-lint/bin/genvm-lint check contracts/priceguard.py
/Users/mralbert/.venvs/genvm-lint/bin/genvm-lint schema contracts/priceguard.py
npm audit --omit=dev
git diff --check
```
