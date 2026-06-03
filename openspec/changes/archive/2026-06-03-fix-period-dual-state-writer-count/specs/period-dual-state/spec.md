# period-dual-state Specification (delta)

This delta corrects the writer set of the `period-dual-state` invariant: two of
the previously-listed six writers (carry-over and lead-section save) write no
`Report` period field, verified by reading the code this session. The genuine
writers all route through `period-transition.ts::buildTransition`.

## MODIFIED Requirements

### Requirement: Atomic Dual-State Write

Every writer that mutates a `Report` period MUST update both `periodState` and the
legacy period tuple in the same Prisma transaction, never in separate database
round-trips.

#### Scenario: Head publish updates both fields

- **WHEN** the head publish path in `apps/api/src/modules/publication/`
  transitions a `Report` to published state
- **THEN** both `periodState` and the legacy period tuple are written in the same
  transaction, with no intermediate commit containing only one of the two
  representations

#### Scenario: Lead section save does NOT write the Report period

- **WHEN** the lead save path saves a section via
  `apps/api/src/modules/report-sections/` (the `weekly-report` module only reads
  the `Report`)
- **THEN** the transaction writes `reportSection` / `item` / `risk` / `decision`
  / `projectStatus` / `stageStatus` rows only
- **AND** it writes no `Report` period field, so it is NOT a period writer and is
  exempt from this invariant

### Requirement: All Report-Period Writers Must Comply

Every code path that writes a `Report` period MUST update both `periodState` and
the legacy period tuple atomically by calling `period-transition.ts::buildTransition`
(the canonical field-set source) within its own Prisma transaction. The writers
are head-publish, archive, manual admin edit, unarchive, snapshot restore, and the
auto-archiver and period-creator schedulers; snapshot restore is the recognised
non-transition writer that reinstates persisted values behind its gate opt-out.
Carry-over and lead-section save are NOT period writers (they write child rows into
an already-created `Report`) and are exempt.

#### Scenario: A real writer updates both fields via buildTransition

- **WHEN** the archive path in `apps/api/src/modules/archive/` (or any listed
  writer) transitions a `Report`
- **THEN** both `periodState` and the legacy tuple are produced by
  `buildTransition` and written atomically in one transaction

#### Scenario: Carry-over is not a period writer

- **WHEN** the carry-over path in `apps/api/src/modules/carry-over/` runs
- **THEN** `saveCarryOver` writes only `carryOverExecution` / `carryOverRecord` /
  `item` / `decision` child rows
- **AND** it writes no `Report` period field, relying on the target `Report`
  already carrying both representations from its creation
