## MODIFIED Requirements

### Requirement: Deciding a reopen request is race-safe

Deciding a reopen request MUST be atomic against concurrent deciders. The
decision MUST re-check `status = 'pending'` inside the same transaction that
records the decision, so that when two deciders act on the same request only the
first takes effect. Approval MUST additionally require, in the same transaction,
that the target section is still `submitted`; if it is no longer submitted (for
example a head separately revoked it), the request MUST become terminal — it MUST
leave the pending queue (so the pending list and count no longer return it) with
no section change — and the approve/reject funnel metric MUST NOT be skewed by it.
The section flip and the funnel metric increment MUST happen only for the decision
that wins; a losing decision MUST change nothing and MUST report that the request
was already processed.

Before any request or section mutation, the decision transaction MUST lock the
parent report through the same shared lifecycle gate used by section writes. A
publish, archive, or contradictory lifecycle that wins before this lock MUST
leave the request pending and the section submitted; neither approval nor
rejection may mutate a closed report. A legal period deletion that wins before
this lock removes the report, its sections and their requests; the decision
MUST then fail as not found and MUST NOT recreate or mutate any row.

#### Scenario: Concurrent approve and reject

- **WHEN** a head and an admin submit a decision for the same pending request at
  the same time
- **THEN** exactly one decision is recorded, the section is flipped at most once,
  the metric is incremented once, and the losing call reports "already processed"

#### Scenario: Approval of a request whose section was already revoked

- **WHEN** a head approves a pending request whose section is no longer
  `submitted` (it was separately revoked to `draft`)
- **THEN** the section is not flipped again, the approve/reject funnel metric is
  not incremented, the request becomes terminal and drops out of the pending list
  and count, and the call reports the request as stale

#### Scenario: Publish wins request approval

- **WHEN** publish commits after approval starts but before the decision
  transaction locks the parent report
- **THEN** approval fails closed, the request stays pending, and the section
  stays submitted

#### Scenario: Period deletion wins a request decision

- **WHEN** an administrator deletes the open draft period after a decision has
  read the request but before the decision transaction locks the parent report
- **THEN** the decision fails as not found, and the request and section stay
  deleted
