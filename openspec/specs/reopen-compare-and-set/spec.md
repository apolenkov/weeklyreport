## Purpose

Guards period reopen and manual archive with atomic compare-and-set writes so a concurrent reopen-versus-archive race never corrupts the period dual-state.

## Requirements

### Requirement: Reopen Is a Guarded Compare-And-Set

Head reopen MUST transition a `Report` through a guarded compare-and-set applied
to `report.updateMany`, never through an unconditional
`report.update({ where: { id } })`. The service-read report that passed scope,
single-reopen, and policy gates MUST be supplied as the expected state. The
predicate MUST contain `id`, `periodStart`, `periodEnd`, and the complete current
lifecycle tuple. The expected state MUST be non-archived with
`periodStatus="published"`. Together these conditions close the
reopen-versus-archive race and reject every other lifecycle or reporting-envelope
change inside the read-to-write window.

The complete reopen field set MUST continue to come from
`period-transition.ts::buildTransition("reopen", …)`, preserving the
single-transition-writer invariant; the compare-and-set changes only the write's
guard, not its field set.

#### Scenario: Only a published, non-archived period reopens

- **GIVEN** a `Report` row and a head reopen request
- **WHEN** the guarded `updateMany` runs
- **THEN** the row is matched only if the complete lifecycle tuple and both
  reporting boundaries still equal the service-read published, non-archived
  expectation
- **AND** an archived, no-longer-published, or otherwise changed row does not
  transition.

#### Scenario: Archive inside the window loses to the guard

- **GIVEN** a period archived between the service pre-check read and the guarded
  reopen write
- **WHEN** the guarded `updateMany` runs against the now-archived row
- **THEN** it matches zero rows because the `archived: false` clause fails
- **AND** the reopen does not proceed, so `archived=true` with
  `periodState="open"` is never committed.

### Requirement: A Zero-Row Reopen Fails Closed

When the guarded reopen write matches zero rows, the caller MUST fail closed and
MUST NOT treat the no-op as a completed reopen. An archived row retains the
archived domain outcome; a row that is no longer published retains the
not-reopenable outcome; a missing row or a still-published, non-archived row
whose other lifecycle or boundary fields changed MUST produce a typed
stale-state conflict.

#### Scenario: Raced archive surfaces as a fail-closed error

- **GIVEN** an admin archive that won the row before the head's guarded reopen
  write
- **WHEN** the reopen `updateMany` matches zero rows
- **THEN** the reopen path raises its domain error and returns no success outcome
- **AND** no report or section state is mutated by the losing reopen.

#### Scenario: A still-published report changes inside the window

- **GIVEN** a report passed the service's reopen gates
- **WHEN** a lifecycle field or period boundary changes before the guarded write
  while the report remains published and non-archived
- **THEN** the helper reports stale and the caller surfaces a conflict
- **AND** no report section is reset to draft.

### Requirement: The Section Draft-Reset Is Gated on the Transition

The reopen path's `reportSection.updateMany` draft-reset MUST run only when the
guarded compare-and-set transitioned the row — it resets `submitted` sections to
`draft`. When
the compare-and-set matched zero rows, no sections may be reset. This prevents an
archive that won the race from being left with an archived period whose sections
were silently reset to draft.

#### Scenario: Losing reopen resets no sections

- **GIVEN** a reopen whose guarded write matched zero rows because an archive won
- **WHEN** the reopen path handles the zero-row outcome
- **THEN** it resets no `reportSection` rows to `draft`
- **AND** the archived period retains its `submitted` sections.

#### Scenario: Winning reopen resets its sections in the same transaction

- **GIVEN** a reopen whose guarded write transitioned the row
- **WHEN** the reopen path continues
- **THEN** the `submitted` sections are reset to `draft` inside the same
  transaction as the transition
- **AND** there is no committed state where the period is reopened but its
  sections were not reset, nor the reverse.
- **AND** the same transaction closes the period's pending section reopen
  requests (see the requirement "A period reopen closes the pending section
  requests it supersedes" in `reopen-requests`).

### Requirement: Admin Manual Archive Is Guarded Against the Reopen Race

Admin manual archive MUST apply a guarded predicate
`{ id, archived: false, periodStatus: { not: "reopened" } }` via
`report.updateMany` and MUST treat a `count === 0` match as a fail-closed
already-archived domain error, rather than issuing an unconditional
`report.update` with no server-side state pre-check. The archive field set MUST
still come from `buildTransition("archive", …)`. Excluding `reopened` (rather
than requiring `published`) makes the manual archive write mutually exclusive
with a concurrent reopen — a reopen that wins the row flips `periodStatus` to
`reopened` and drops the archive to zero rows — while keeping scheduled/open
periods archivable (head/admin archive is unbounded by period status; product
decision).

#### Scenario: Manual archive of an already-archived period fails closed

- **GIVEN** a period already archived by a concurrent writer
- **WHEN** admin manual archive runs its guarded `updateMany`
- **THEN** it matches zero rows and raises an already-archived domain error
- **AND** it does not re-write the row.

#### Scenario: Manual archive still writes both period representations

- **GIVEN** a non-archived period and a manual archive request
- **WHEN** the guarded `updateMany` matches the row
- **THEN** both the companion `archived` boolean and `periodState="archived"` are
  written from `buildTransition("archive", …)` in that single statement.

### Requirement: Reopen Atomicity Is Covered by an Integration Test

At least one automated integration test MUST assert, against real Postgres, that
a concurrent reopen-versus-archive resolves without corrupting the period
dual-state. The test MUST verify that no committed row is editable-archived
(`archived=true` with `periodState="open"`) and no archived period is left with
its sections reset to draft, and that exactly one writer wins while the loser
fails closed.

#### Scenario: Concurrent reopen and archive leave a consistent row

- **GIVEN** one published `Report` with `submitted` sections
- **WHEN** a reopen and an archive run concurrently against it
- **THEN** exactly one writer transitions the row and the other fails closed
- **AND** the committed row is never `archived=true` with `periodState="open"`,
  and an archived outcome never has its sections reset to draft.
