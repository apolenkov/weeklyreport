## ADDED Requirements

### Requirement: The scheduled-to-open flip is a guarded compare-and-set

`flipDueScheduledToOpen` MUST write each due row's transition as a guarded
update that re-asserts `periodState: 'scheduled'` in the same statement as
the write (a Prisma `updateMany` with that predicate, or an equivalent
atomic compare-and-set) — never an unconditional update keyed only on the
row's id. When the guarded write affects zero rows, the scheduler MUST treat
it as a benign concurrent-writer skip (log and continue), the same way
`AutoArchiverScheduler`'s guarded write treats its own zero-row case, so a
row that a concurrent writer (for example an admin archive) transitioned
away from `scheduled` inside the same cron tick is never silently
overwritten back to `open`.

#### Scenario: A concurrently archived row is not clobbered by the flip

- **GIVEN** a `scheduled` row that `flipDueScheduledToOpen` selected as due
- **WHEN** another writer archives that row after the selection scan but
  before the flip's write executes
- **THEN** the flip's guarded write affects zero rows
- **AND** the row remains archived — its `periodState` and `archived` fields
  are not reset to `open`/`false`

#### Scenario: A row still scheduled at flip time opens normally

- **GIVEN** a `scheduled` row whose `periodStart` has been reached and which
  no concurrent writer has touched
- **WHEN** `flipDueScheduledToOpen` processes it
- **THEN** the row transitions to `open` via the full governed
  `buildTransition('open', {})` field set, unchanged from prior behavior

### Requirement: At most one row per scheduling boundary across scheduled and open states

The database MUST NOT permit two rows sharing the same `(periodStart,
periodEnd)` boundary to both be in a live pre-published state
(`scheduled` or `open`) at once. A duplicate `scheduled` row inserted by a
racing concurrent creator MUST NOT persist as a permanent orphan once its
boundary's winning row reaches `open` — either the uniqueness guarantee is
enforced at insert time across both states, or a reconcile step removes the
losing duplicate once the boundary resolves.

#### Scenario: Two concurrent creators cannot both persist a scheduled row for the same boundary

- **WHEN** two period-creation attempts race for the same
  `(periodStart, periodEnd)` boundary
- **THEN** at most one `scheduled` (or `open`) row for that boundary
  survives — the loser either fails its insert/update or is reconciled away

#### Scenario: A duplicate scheduled row does not sit orphaned forever

- **GIVEN** a duplicate `scheduled` row exists for a boundary whose other
  row has already opened
- **WHEN** the scheduler runs a subsequent tick
- **THEN** the duplicate is not left indefinitely re-scanned and
  warn-logged with no resolution — it is either prevented from having been
  created in the first place, or removed
