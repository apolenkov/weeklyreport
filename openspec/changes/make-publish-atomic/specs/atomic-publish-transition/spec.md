## ADDED Requirements

### Requirement: Publish Is a Conditional Compare-And-Set

The system SHALL transition a period to published with a conditional update
that matches only a not-yet-published row, so two concurrent publishes
transition the period at most once.

Both publish entry points are governed: the repository write behind
`PeriodService.publishPeriod`
(`apps/api/src/modules/period/period.prisma-repository.ts::publishPeriod`,
tRPC procedure `period.publish`) and the assembled-report write behind
`PublicationService.publishReport`
(`apps/api/src/modules/publication/publication.service.ts`, tRPC procedure
`review.publish`). Each write MUST carry the not-published predicate (the
`periodStatus`/`status` field `!= "published"`) in its `WHERE` clause and MUST
report how many rows it transitioned (0 or 1). The pre-write status check MAY
remain as a fast-path rejection, but it MUST NOT be the only guard.

#### Scenario: Two concurrent publishes transition the period once

- **WHEN** two `review.publish` (or `period.publish`) calls for the same
  not-yet-published period run concurrently and both pass the pre-write status
  check
- **THEN** the compare-and-set transitions exactly one row to published
- **AND** the other call's update matches zero rows and performs no transition

#### Scenario: Publishing an already-published period transitions nothing

- **WHEN** a publish runs against a period whose status is already
  `"published"`
- **THEN** the compare-and-set matches zero rows
- **AND** no field of the period is modified

### Requirement: Redundant Publish Side Effects Run At Most Once

The system SHALL perform the publish side effects — rebuilding the published
snapshot and enqueuing post-publish ingestion — at most once per real
transition.

A publish whose compare-and-set transitioned zero rows MUST NOT rebuild the
snapshot again and MUST NOT enqueue ingestion again. It MAY return the
existing published result as an idempotent response.

#### Scenario: Losing concurrent publish does not rebuild the snapshot

- **WHEN** a publish call's compare-and-set transitions zero rows because a
  concurrent call already published the period
- **THEN** the losing call does not rebuild the published snapshot
- **AND** it does not enqueue post-publish ingestion
- **AND** it either returns the already-published result or a domain
  "already published" error, never a partial re-publish

### Requirement: Publish Target Resolves From the Database

The system SHALL resolve the target period for `review.publish` and
`review.assembledReport` from the database — the current open or reopened
period — rather than from the JWT `ctx.session.activeReportId`, which is baked
at login and can be stale.

The resolution MUST use the same database query as `review.dashboard`
(`apps/api/src/infrastructure/trpc/trpc.router.ts`): the newest period with
`periodStatus in ("open", "reopened")` and `periodStart <= now`. When no such
period exists, the procedures MUST surface a domain "no active period" error
rather than acting on a stale id.

#### Scenario: Publish targets the period shown on the dashboard

- **WHEN** the head triggers `review.publish` while the session
  `activeReportId` points at an older period than the current open period
- **THEN** the publish acts on the current open/reopened period resolved from
  the database, the same one `review.dashboard` displays
- **AND** the stale `activeReportId` is not used to select the target

#### Scenario: Assembled report reflects the database-resolved period

- **WHEN** the head opens `review.assembledReport`
- **THEN** the assembled report is built for the database-resolved
  open/reopened period, not the session `activeReportId`

#### Scenario: No open period yields a domain error

- **WHEN** `review.publish` or `review.assembledReport` runs and the database
  has no open or reopened period with `periodStart <= now`
- **THEN** the procedure raises a domain "no active period" error
- **AND** no period is published
