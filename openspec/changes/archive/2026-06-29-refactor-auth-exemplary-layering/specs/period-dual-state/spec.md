## MODIFIED Requirements

### Requirement: All Report-Period Writers Must Comply

Every code path that writes a `Report` period MUST update both `periodState` and
the legacy period tuple atomically by calling `period-transition.ts::buildTransition`
(the canonical field-set source) within its own Prisma transaction. The writers
are head-publish, archive, manual admin edit, unarchive, snapshot restore, the
auto-archiver and period-creator schedulers, and the login-time period factory
that materialises the current reporting period when a lead logs in; snapshot
restore is the recognised non-transition writer that reinstates persisted values
behind its gate opt-out. The login-time factory and the period-creator scheduler
share one implementation, so there is exactly one period-creation formula.
Carry-over and lead-section save are NOT period writers (they write child rows into
an already-created `Report`) and are exempt.

#### Scenario: A real writer updates both fields via buildTransition

- **WHEN** the archive path in `apps/api/src/modules/archive/` (or any listed
  writer) transitions a `Report`
- **THEN** both `periodState` and the legacy tuple are produced by
  `buildTransition` and written atomically in one transaction

#### Scenario: The login-time period factory complies

- **WHEN** the login-time period factory creates the current-week `Report`
  because a lead logged in and none existed
- **THEN** both `periodState` and the legacy tuple are produced by
  `buildTransition`
- **AND** the create does not write a governed lifecycle field raw outside the
  Period transition module

#### Scenario: Carry-over is not a period writer

- **WHEN** the carry-over path in `apps/api/src/modules/carry-over/` runs
- **THEN** `saveCarryOver` writes only `carryOverExecution` / `carryOverRecord` /
  `item` / `decision` child rows
- **AND** it writes no `Report` period field, relying on the target `Report`
  already carrying both representations from its creation
