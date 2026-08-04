## Purpose

The `Report` model in `prisma/schema.prisma` carries two parallel period representations: a `periodState` field (the canonical representation) and a legacy period tuple (year, week, quarter, and related fields). Every code path that writes a `Report` MUST update both representations atomically in a single Prisma transaction. Because no database constraint enforces this invariant, the spec acts as the program-level contract; enforcement relies on code review and dedicated tests.

Consumer surfaces: `prisma/schema.prisma` (`Report` model), `apps/api/src/modules/publication/` (head publish path), `apps/api/src/modules/archive/`. The `weekly-report` module only reads the `Report`, and `carry-over` writes only child rows into an already-created `Report`; neither is a Report-period writer.

## Requirements

### Requirement: Atomic Dual-State Write

Every writer that mutates a `Report` period MUST update both `periodState` and the legacy period tuple in the same Prisma transaction, never in separate database round-trips.

#### Scenario: Lead section save does NOT write the Report period

- **WHEN** the lead save path saves a section via
  `apps/api/src/modules/report-sections/` (the `weekly-report` module only reads
  the `Report`)
- **THEN** the transaction writes `reportSection` / `item` / `risk` / `decision`
  / `projectStatus` / `stageStatus` rows only
- **AND** it writes no `Report` period field, so it is NOT a period writer and is
  exempt from this invariant

#### Scenario: Head publish updates both fields

- **WHEN** the head publish path in `apps/api/src/modules/publication/` transitions a `Report` to published state
- **THEN** both `periodState` and the legacy period tuple are written in the same transaction, with no intermediate commit containing only one of the two representations

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

### Requirement: New Writers Must Not Omit Either Field

Any code path added after this spec that mutates the period representation of a `Report` MUST update both `periodState` and the legacy period tuple. Updating only one field, even with a correct value, is a violation of this invariant.

#### Scenario: Seventh writer omits legacy tuple

- **WHEN** a new writer updates only `periodState` on a `Report` row, leaving the legacy tuple unchanged
- **THEN** downstream readers that consume the legacy tuple observe a stale period value, producing a phantom divergence between the two representations

#### Scenario: Seventh writer omits periodState

- **WHEN** a new writer updates only the legacy period tuple on a `Report` row, leaving `periodState` unchanged
- **THEN** downstream readers that consume `periodState` observe a stale value, producing a phantom divergence

### Requirement: Atomicity Must Be Covered by an Automated Test

At least one automated integration test MUST assert that the dual-state
write invariant holds. The test MUST verify that a rolled-back transaction
leaves neither `periodState` nor the legacy period tuple in a partially
updated state.

#### Scenario: Transaction rolls back mid-write

- **WHEN** a writer begins a dual-state update and the Prisma transaction rolls back before both fields are committed
- **THEN** neither `periodState` nor the legacy period tuple reflects the new value
- **AND** the `Report` row remains in its prior consistent state

### Requirement: Divergence Is a Runtime Crash Risk

The absence of a database constraint means Postgres will silently accept a row where `periodState` and the legacy tuple disagree. The system MUST treat any detected divergence between the two representations as an error condition, not a recoverable inconsistency.

#### Scenario: Divergent row reaches a downstream reader

- **WHEN** a `Report` row exists where `periodState` and the legacy period tuple disagree
- **THEN** readers that consume `periodState` and readers that consume the legacy tuple produce different period values for the same report, causing visible data inconsistency for users and potential runtime crashes in code paths that compare both fields

### Requirement: Lifecycle Transitions Go Through a Single Transition Writer

Every code path that mutates a `Report`'s lifecycle representation MUST do so
by invoking the single Period transition module, never by hand-assembling the
field set inline. The module governs exactly these lifecycle fields:
`periodState`, the legacy `status` and `archived` tuple, `periodStatus`, the
`autoPublished` / `autoArchived` audit flags, and the
`publishedAt` / `publishedById` / `reopenedAt` timestamps. The period identity
tuple (`year`, `week`, `quarter`) is written only at creation and is NOT
governed by this requirement.

Each transition (`create`, `schedule`, `open`, `publish`, `autoPublish`,
`reopen`, `archive`, `autoArchive`, `unarchive`) MUST produce the complete field
set for that transition so that no representation can be written without the
others.

#### Scenario: Writer mutates lifecycle state via the transition module

- **WHEN** any repository, service, or scheduler transitions a `Report`'s
  lifecycle state
- **THEN** it calls the transition module's apply function within its own
  Prisma transaction
- **AND** the resulting `report.update` writes the complete governed field set
  for that transition in a single round-trip

#### Scenario: Auto-publish writes the full lifecycle set atomically

- **WHEN** the auto-publisher promotes a draft `Report` past its deadline
- **THEN** `status`, `periodStatus`, `periodState`, and `autoPublished` are
  written in the same transaction
- **AND** the published report's `periodStatus` is `"published"` (not left at
  the default `"open"`), matching the manual publish path
- **AND** there is no committed state where `status` is `"published"` while
  `autoPublished` is still `false`

### Requirement: Raw Lifecycle-Field Writes Are Forbidden Outside the Module

A continuous-integration gate MUST fail the build when a `report.update` or
`report.create` call writes any governed lifecycle field outside the Period
transition module. This converts the dual-state contract from a review-only
convention into a machine-checked invariant.

A write that is demonstrably NOT a lifecycle transition — specifically a
snapshot restoration that reinstates independently-persisted values rather than
coupling the three machines into one intent — MAY opt out via an explicit,
reviewed call-site marker that names a follow-up reference. Deriving such a
write through the transition module would corrupt legitimately-divergent rows
(a reopened period is `status="published"` while `periodState="open"`). Every
other governed-field write outside the module MUST fail the gate.

#### Scenario: A new writer bypasses the transition module

- **WHEN** code is added that writes `periodState`, `status`, `periodStatus`,
  `archived`, `autoPublished`, or `autoArchived` directly via Prisma outside the
  transition module
- **THEN** the CI gate fails and the build is rejected

#### Scenario: A non-transition restore opts out via an explicit marker

- **WHEN** a write that reinstates persisted values (not a transition) carries
  an explicit call-site opt-out marker naming a follow-up reference
- **THEN** the CI gate skips that specific call site
- **AND** the same write WITHOUT the marker still fails the gate, so the opt-out
  is per-site and reviewable, never a blanket off-switch

### Requirement: Admin Snapshot Restore Preserves the Full Lifecycle Field Set

The admin snapshot export (`getSnapshot`) and restore (`applySnapshot`) MUST
round-trip a `Report`'s complete governed lifecycle field set — `periodState`,
the legacy `status` and `archived` tuple, `periodStatus`, the
`autoPublished` / `autoArchived` audit flags, and the
`publishedAt` / `publishedById` / `reopenedAt` timestamps — so a restored period
is never left in a state the `period-dual-state` invariant forbids.

The restore reinstates these independently-persisted values verbatim; it MUST
NOT derive them through the transition module, because no single transition can
reproduce a legitimately-divergent row (a reopened period is `status="published"`
while `periodState="open"` and `periodStatus="reopened"`). The restore therefore
remains a recognised non-transition writer and keeps its explicit
gate opt-out marker.

A snapshot taken before this field set existed MUST still restore to an
internally-consistent row by falling back to the documented legacy-tuple
backfill for any absent field.

#### Scenario: A published period survives a snapshot round-trip

- **WHEN** a published `Report` is captured by `getSnapshot` and later restored
  by `applySnapshot`
- **THEN** the restored row has `status="published"`, `periodStatus="published"`,
  and `periodState="published"`
- **AND** it is visible to viewers and serves its published snapshot, exactly as
  before the round-trip

#### Scenario: A reopened period is not flattened by restore

- **WHEN** a reopened `Report` (`status="published"`, `periodState="open"`,
  `periodStatus="reopened"`) is captured and restored
- **THEN** all three machines are reinstated to their distinct captured values
- **AND** the restore does not derive `status` from `periodState` (which would
  flip it back to `"draft"`)

#### Scenario: A legacy snapshot restores to a consistent row

- **WHEN** a snapshot that predates the extended field set is restored
- **THEN** absent lifecycle fields are filled from the legacy-tuple backfill
  (e.g. `archived` ? `archived` : `status="published"` ? `published` : `open`)
- **AND** the restored row is internally consistent, never `status="published"`
  with a stale default `periodState="open"`

### Requirement: Current period wire models require a complete consistent lifecycle tuple

The current `reportPeriodSchema` and `periodReadModelSchema` surfaces MUST require the canonical state, legacy status and archived fields, period status, audit flags, and applicable timestamps, and MUST reject every contradictory tuple. Legacy snapshot compatibility MUST use a separately named versioned decoder that returns a value accepted by the strict current schema.

#### Scenario: Current payload omits a lifecycle field

- **WHEN** a current report-period or period-read-model payload omits any governed lifecycle field
- **THEN** shared schema parsing fails instead of manufacturing a default or falling back to the legacy tuple

#### Scenario: Supported legacy snapshot is decoded

- **WHEN** an explicitly versioned supported legacy snapshot omits fields that did not exist in that version
- **THEN** the legacy decoder derives one complete consistent tuple and the result passes the strict current schema

#### Scenario: Legacy snapshot is ambiguous or contradictory

- **WHEN** a legacy payload cannot determine exactly one valid current lifecycle tuple
- **THEN** decoding fails with a typed incompatibility error and no current read model is produced

### Requirement: Lifecycle narrowing is exhaustive and fail-closed

The period factory, `resolveActiveWorkspace`, and manual period creation surfaces MUST accept only their explicitly allowed lifecycle states and MUST reject `published`, `archived`, null, missing, or contradictory state rather than coercing it to `open`.

#### Scenario: Factory receives an unexpected persisted state

- **WHEN** a draft lookup returns a row whose canonical state is published, archived, missing, or inconsistent with the legacy tuple
- **THEN** the factory returns a typed integrity failure and MUST NOT advertise the row as open

#### Scenario: Manual creation receives a widened state

- **WHEN** a direct service or repository caller supplies any state other than scheduled or open
- **THEN** manual creation rejects the input before constructing or writing a transition

#### Scenario: Session lookup encounters an archived draft

- **WHEN** the newest legacy-draft report is archived or has a non-live canonical state
- **THEN** `resolveActiveWorkspace` excludes it and MUST NOT embed its section as an editable workspace for any role

### Requirement: Unarchive is a tuple-guarded compare-and-set

`unarchivePeriod` MUST derive and write its transition in one transaction whose update predicate contains the complete lifecycle tuple read for the decision. The operation MUST succeed only when exactly one row still matches that tuple.

#### Scenario: Lifecycle changes between decision and write

- **WHEN** publish, reopen, archive, or another unarchive changes any governed field after the unarchive decision is formed
- **THEN** the guarded update affects zero rows, returns a typed stale-state conflict, and preserves the concurrent transition

#### Scenario: Boundary uniqueness conflicts

- **WHEN** a valid unarchive collides with a row holding the same scheduling boundary
- **THEN** the transaction rolls back without a partial lifecycle tuple and returns the typed overlap conflict

### Requirement: Lifecycle write enforcement is semantic and conservative

The lifecycle write gate MUST resolve Prisma Report delegate aliases and data values through the TypeScript program. Any governed write outside the transition owner, or any governed write whose data provenance cannot be resolved, MUST fail the gate.

#### Scenario: Equivalent bypass forms are planted

- **WHEN** probes write governed fields through direct, aliased, computed, variable, helper-returned, conditional, or spread-produced forms
- **THEN** every form fails unless it consumes the sanctioned transition result inside the transition owner

#### Scenario: Exemption marker is malformed or unreferenced

- **WHEN** a write carries an unknown, unreferenced, or out-of-owner exemption marker
- **THEN** the lifecycle gate fails rather than accepting the marker as evidence
