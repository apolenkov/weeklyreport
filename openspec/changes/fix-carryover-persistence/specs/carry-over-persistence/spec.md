## ADDED Requirements

### Requirement: Carry-over persists every target section

The system SHALL persist carried items and unresolved decisions for ALL target
report sections in a carry-over execution, not only the first section.

`CarryOverService.executeCarryOver` computes carried rows for every lead's
section; the repository method `CarryOverPrismaRepository.saveCarryOver`
(`apps/api/src/modules/carry-over/carry-over.prisma-repository.ts`) MUST write
those rows into each corresponding target `ReportSection`, so the persisted
`Item`/`Decision` count matches the `CarryOverExecution` `carriedItemCount` /
`carriedDecisionCount`.

#### Scenario: Multi-lead report carries every section

- **GIVEN** a source report and a target report each with two lead sections
- **AND** each source section has an unfinished next-week item and an unresolved
  decision
- **WHEN** `executeCarryOver(sourceReportId, targetReportId)` runs
- **THEN** both target sections receive their carried item and decision
- **AND** the total persisted item and decision counts equal the execution's
  reported `carriedItemCount` and `carriedDecisionCount`

#### Scenario: Counts never exceed what is persisted

- **GIVEN** a completed carry-over execution
- **WHEN** the persisted `CarryOverRecord` rows are counted by type
- **THEN** the count of `item` records equals the number of carried `Item` rows
  actually written across all target sections
- **AND** the count of `decision` records equals the number of carried
  `Decision` rows actually written across all target sections

### Requirement: Carried decisions and items persist stage labels as an array

The system SHALL write stage labels for carried decisions and carried items to
the `stageNames String[]` column, and MUST NOT reference the non-existent scalar
`stageName` field on the Prisma `Decision` or `Item` model.

The write MUST mirror `report-sections.prisma-repository.ts` by mapping the
domain `stageIds` to `stageNames: d.stageIds ?? []`, so a source decision with
an unresolved status no longer aborts the enclosing `$transaction`.

#### Scenario: Unresolved decision carries over without crashing

- **GIVEN** a source section with an unresolved decision that has a product and
  one or more `stageIds`
- **WHEN** carry-over runs
- **THEN** the transaction commits successfully
- **AND** the carried target `Decision` has `stageNames` equal to the source
  decision's `stageIds`

#### Scenario: No write references the scalar stageName field

- **WHEN** the carry-over repository builds the `Decision` and `Item` create
  payloads
- **THEN** the payload uses the `stageNames` array field only
- **AND** no field named `stageName` appears in any carry-over create payload

### Requirement: Carried items retain priority rank and stage labels

The system SHALL include `priorityRank` and `stageNames` on every carried `Item`
created by the carry-over write path.

A carried item MUST land in the next period with the same `priorityRank` and
`stageNames` it held in the source section, so leads do not lose ranking or
stage context across the period boundary.

#### Scenario: Ranked, staged item carries its rank and stages

- **GIVEN** a source next-week item with `priorityRank = 2` and
  `stageIds = ["design", "build"]`
- **WHEN** carry-over runs
- **THEN** the carried target `Item` has `priorityRank = 2`
- **AND** the carried target `Item` has `stageNames = ["design", "build"]`

### Requirement: Concurrent dedupe race is handled without a server error

The system SHALL handle a unique-constraint violation on the
`CarryOverExecution.dedupeKey` column without surfacing a raw Prisma `P2002` as
an unhandled 500.

When two carry-over executions for the same source/target pair race past the
app-level idempotency check, the second insert MUST be resolved to the existing
execution (idempotent success) or a friendly carry-over domain conflict, in the
same spirit as the reopen-request P2002 translation in
`lead-form.prisma-repository.ts`. The handling MUST NOT introduce a `failed`
`CarryOverStatus` write, preserving the enum-state-hygiene disposition that the
service writes only `completed`.

#### Scenario: Concurrent duplicate does not 500

- **GIVEN** two carry-over executions for the same source and target report run
  concurrently and both pass the app-level existing-execution check
- **WHEN** the second insert hits the `dedupeKey` unique constraint (P2002)
- **THEN** the operation does not throw an unhandled Prisma error / 500
- **AND** the caller observes the already-recorded execution or a carry-over
  domain conflict error

#### Scenario: No failed status is written on conflict

- **WHEN** the dedupe race is resolved
- **THEN** no `CarryOverExecution` row is written with status `failed`
