# Covenant state machine

PriceGuard Covenant is non-custodial. It has no payable methods, balances,
liabilities, claims, refunds, escrow, or transfers.

PERSONAL covenants start ACTIVE. BILATERAL covenants start
PENDING_ACCEPTANCE and become ACTIVE only when the named counterparty accepts.
Accepted terms are immutable. Active covenants may be evaluated while within
their validity window. A satisfied evaluation transitions once to TRIGGERED;
an unsatisfied evaluation remains ACTIVE. Expiry transitions an untriggered
covenant to EXPIRED. A PERSONAL covenant closes after creator acknowledgement;
a BILATERAL covenant closes after both named parties acknowledge. Cancellation
is creator-only and limited to pre-acceptance bilateral covenants.
