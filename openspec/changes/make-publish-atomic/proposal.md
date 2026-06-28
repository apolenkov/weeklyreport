## Why

Publishing a weekly report is a head-only action triggered by a button, but
the two server publish paths read the period status and then write by id with
no guard in between. A double-click or two concurrent head tabs both pass the
"already published?" check, both rebuild the published snapshot, and both
increment the publish counters — inflating the very on-time ratio the code
comment claims to protect. Separately, `review.publish` and
`review.assembledReport` still resolve their target from the JWT
`activeReportId` (baked at login, can be stale), while `review.dashboard` was
deliberately moved to resolve the open/reopened period from the database — so
the head can publish a different period than the one shown on the dashboard.

Source: repo-excellence review backlog item `BL-PUBLISH-ATOMICITY` (P1),
`docs/repo-excellence-review-2026-06-28.md` line 179.

## What Changes

- Turn the publish write into a conditional compare-and-set: the repository
  `UPDATE ... WHERE id = ? AND <status> != 'published'` and reports how many
  rows it transitioned (0 or 1).
- Treat a publish that transitions 0 rows as a no-op idempotent result, not a
  second transition: the snapshot is rebuilt and ingestion enqueued at most
  once per real transition.
- Emit `customreportReportsSubmittedTotal` and
  `customreportPeriodStateTransitionsTotal` only when the compare-and-set
  actually transitioned the row (count === 1).
- Apply this to both publish entry points: `period.publish` →
  `PeriodService.publishPeriod` and `review.publish` →
  `PublicationService.publishReport`.
- Resolve the `review.publish` / `review.assembledReport` target period from
  the database (the current open/reopened period, same query
  `review.dashboard` uses) instead of `ctx.session.activeReportId`.

## Non-goals

- Group-scope authorization of the publish target (tracked separately in
  `scope-period-lifecycle-authz`).
- Adding a database uniqueness/partial-index constraint
  (`period-uniqueness-db-constraint`).
- Reconciling the two parallel publish code paths into one; this change makes
  both correct without merging them.

## Capabilities

### New Capabilities

- `atomic-publish-transition`: publish/republish is an idempotent
  compare-and-set that transitions a period at most once under concurrency and
  resolves its target period from the database, not a stale session value.

### Modified Capabilities

- `manual-publish-telemetry`: the publish counters increment only when the
  compare-and-set transitioned exactly one row, so a redundant concurrent or
  repeat publish emits nothing.

## Impact

- `apps/api/src/modules/period/period.service.ts`
- `apps/api/src/modules/period/period.prisma-repository.ts`
- `apps/api/src/modules/publication/publication.service.ts`
- `apps/api/src/infrastructure/trpc/trpc.router.ts` (`review.publish`,
  `review.assembledReport`)
- Telemetry consumers of the two publish counters and the on-time-ratio gauge.
- No schema change; no migration (MVP phase).
