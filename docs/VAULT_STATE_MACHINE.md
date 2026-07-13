# Historical vault design removed

The old custodial vault concept is not part of PriceGuard Covenant V2. The
active contract has no payable method, funded amount, beneficiary claim,
creator refund, reserved liability, or transfer path.

Historical `/vaults` frontend URLs redirect to `/covenants` only to avoid broken
bookmarks. The active state machine is documented in
`docs/COVENANT_STATE_MACHINE.md`. Do not use this filename as evidence that V2
contains custody behavior.
