## ADDED Requirements

### Requirement: Reopen Is a Guarded Compare-And-Set

Head reopen MUST transition a `Report` through a guarded compare-and-set whose
predicate is `{ id, archived: false, periodStatus: "published" }`, applied to a
`report.updateMany`, never through an unconditional `report.update({ where: { id } })`.
The `archived: false` and `periodStatus: "published"` clauses MUST both remain in
the predicate — together they are the single point that closes the
reopen-versus-archive race, so a period archived (or otherwise moved off
`periodStatus="published"`) inside the read-to-write window is never reopened.

The complete reopen field set MUST continue to come from
`period-transition.ts::buildTransition("reopen", …)`, preserving the
single-transition-writer invariant; the compare-and-set changes only the write's
guard, not its field set.

#### Scenario: Only a published, non-archived period reopens

- **GIVEN** a `Report` row and a head reopen request
- **WHEN** the guarded `updateMany` runs
- **THEN** the row is matched only if it is `periodStatus="published"` AND not
  `archived`
- **AND** an already-archived or no-longer-published row matches zero rows.

#### Scenario: Archive inside the window loses to the guard

- **GIVEN** a period archived between the service pre-check read and the guarded
  reopen write
- **WHEN** the guarded `updateMany` runs against the now-archived row
- **THEN** it matches zero rows because the `archived: false` clause fails
- **AND** the reopen does not proceed, so `archived=true` with
  `periodState="open"` is never committed.

### Requirement: A Zero-Row Reopen Fails Closed

When the guarded reopen write matches zero rows, the caller MUST fail closed —
raise a domain error — and MUST NOT treat the no-op as a completed reopen. A row
that no longer satisfies the predicate (archived, or already reopened, or no
longer published) is not a reopenable target, and reporting success would leave
the caller believing a transition happened that did not.

#### Scenario: Raced archive surfaces as a fail-closed error

- **GIVEN** an admin archive that won the row before the head's guarded reopen
  write
- **WHEN** the reopen `updateMany` matches zero rows
- **THEN** the reopen path raises its domain error and returns no success outcome
- **AND** no report or section state is mutated by the losing reopen.

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

### Requirement: Admin Manual Archive Is Guarded Against the Reopen Race

Admin manual archive MUST apply a guarded predicate `{ id, archived: false }` via
`report.updateMany` and MUST treat a `count === 0` match as a fail-closed
already-archived domain error, rather than issuing an unconditional
`report.update` with no server-side state pre-check. The archive field set MUST
still come from `buildTransition("archive", …)`. This makes the manual archive
write mutually exclusive with a concurrent reopen from the archive side of the
race, not only the reopen side.

#### Scenario: Manual archive of an already-archived period fails closed

- **GIVEN** a period already archived by a concurrent writer
- **WHEN** admin manual archive runs its guarded `updateMany`
- **THEN** it matches zero rows and raises an already-archived domain error
- **AND** it does not re-write the row.

#### Scenario: Manual archive still writes both period representations

- **GIVEN** a non-archived period and a manual archive request
- **WHEN** the guarded `updateMany` matches the row
- **THEN** both the legacy `archived` boolean and `periodState="archived"` are
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
