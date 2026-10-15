## ADDED Requirements

### Requirement: A Head Reopens Only the Latest Published Period

A Head reopen (`period.reopenPeriod` tRPC) MUST target the latest non-archived
published period, ordered by `periodStart` then `id` descending. The check MUST
hold inside the reopen transaction, after the status-graph lock and the
single-reopen check, so a publication that commits after the service gates
makes an older target fail closed with the period-scope error and no write.
A Head publication MUST take the same status-graph lock before its writes, so
a publication still committing when the reopen transaction starts is visible
to that check. Admin reopen is a recovery path and MUST remain exempt.

#### Scenario: A newer publication lands after an older Head reopen passed its gates

- **GIVEN** a Head reopen of period A passed the service gates while A was the latest published period
- **WHEN** period B (newer) is published before A's reopen transaction runs
- **THEN** A's reopen fails with the period-scope error and A is unchanged
- **AND** a Head reopen of B succeeds, leaving B as the only reopened period

#### Scenario: A Head publication is still committing when an older Head reopen starts its transaction

- **GIVEN** a Head reopen of period A passed the service gates while A was the latest published period
- **AND** no reminder policy exists, so no policy row lock orders the two transactions
- **WHEN** the Head publication of newer period B has written but not yet committed as A's reopen transaction starts
- **THEN** A's reopen waits for B's publication to commit and then fails with the period-scope error
- **AND** B is published, no period is reopened and A is unchanged

#### Scenario: Admin recovery may reopen a historical period

- **GIVEN** a newer published period exists
- **WHEN** an Admin reopens an older published period
- **THEN** the latest-published check does not apply
