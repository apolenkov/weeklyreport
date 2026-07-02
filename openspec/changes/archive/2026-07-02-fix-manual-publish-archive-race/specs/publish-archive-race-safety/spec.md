## ADDED Requirements

### Requirement: Manual Publish Fails Closed On An Archived-In-Window Period

The system SHALL refuse to publish a period that becomes archived between a
manual publish path's status read and its compare-and-set write, never writing a
row that is simultaneously `archived = true` and `periodStatus = "published"`.

Both manual publish writes are governed: the repository write behind
`PeriodService.publishPeriod`
(`apps/api/src/modules/period/period.prisma-repository.ts::publishPeriod`, tRPC
procedure `period.publish`) and the assembled-report write behind
`PublicationService.publishReport`
(`apps/api/src/modules/publication/publication.prisma-repository.ts::publishAssembledReport`,
tRPC procedure `review.publish`). Each compare-and-set predicate MUST carry
`archived = false` in addition to `periodStatus != "published"`, so a period
archived inside the read→write window matches zero rows and is never transitioned.

A zero-row match now has two causes, which MUST be distinguished by re-reading the
target row in the same transaction rather than reported uniformly as idempotent
success:

- the row is now `periodStatus = "published"` — a concurrent publish won the
  compare-and-set: idempotent success, the side effects (snapshot rebuild,
  ingestion enqueue, telemetry) MUST NOT run a second time;
- the row is now `archived = true` — the archive landed in the window: the path
  MUST surface a domain "archived period cannot be published" error (mapped to
  FORBIDDEN), and MUST NOT report success.

The scheduler path (`saveAutoPublishedReport`) already carries `archived = false`
and is unchanged.

#### Scenario: A period archived inside the publish window is not published

- **WHEN** a manual `period.publish` (or `review.publish`) reads its target as
  non-archived, then an `archive` transition sets `archived = true` on that row
  before the compare-and-set write runs
- **THEN** the compare-and-set matches zero rows because its predicate now
  requires `archived = false`
- **AND** the row keeps `archived = true` and is NOT transitioned to
  `periodStatus = "published"`
- **AND** the caller receives a domain "archived period cannot be published"
  error, not an idempotent success

#### Scenario: A concurrent publish still yields idempotent success

- **WHEN** a manual publish's compare-and-set matches zero rows because a
  concurrent publish already transitioned the same period to
  `periodStatus = "published"` (the row is not archived)
- **THEN** the losing call is reported as idempotent success
- **AND** it rebuilds no snapshot, enqueues no ingestion, and emits no telemetry
  counters

### Requirement: Reopened Publish Targets The Single Active Reopened Period

The system SHALL accept a `periodStatus = "reopened"` publish target on the
manual `period.publish` path only when that target is the single active reopened
period, closing the bypass where the frontier check is skipped for any reopened
target.

`PeriodService.publishPeriod` MUST NOT unconditionally skip the active-target
frontier check for a reopened period. When the target is reopened, the path MUST
verify `reportId === getReopenedNonArchivedId()` for a non-admin head; an admin
remains exempt (the recovery path). The legitimate reopen→fix→republish flow is
unaffected: a head reopens at most one period at a time
(`assertNoConcurrentReopen`), so its own reopened target IS the single active
reopened period the equality check accepts.

#### Scenario: A head republishes the period it just reopened

- **WHEN** a non-admin head reopens the current period, edits it, and triggers
  `period.publish` against that same reopened period
- **THEN** the reopened target equals `getReopenedNonArchivedId()` and the
  publish is accepted
- **AND** the reopen→fix→republish flow completes without a scope error

#### Scenario: A head cannot publish an admin-reopened historical period via the reopened skip

- **WHEN** an admin has reopened a historical period while a newer period is
  current-editable, and a non-admin head triggers `period.publish` against that
  historical reopened period that is not `getReopenedNonArchivedId()`
- **THEN** the publish is rejected with a period-scope error
- **AND** the historical reopened period is not transitioned to published
