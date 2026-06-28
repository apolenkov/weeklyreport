## Context

Two server paths publish a weekly report, both check-then-write:

- `period.publish` → `PeriodService.publishPeriod` →
  `period.prisma-repository.ts::publishPeriod`. The repository reads the row,
  then inside a `$transaction` calls `tx.report.update({ where: { id } })`
  with `buildTransition("publish", …)` and rebuilds the published snapshot in
  the same transaction. The service emits the two publish counters after the
  write.
- `review.publish` → `PublicationService.publishReport` →
  `repository.saveAssembledReport(...)`. The service reads the assembled
  report, rejects when `status === "published"`, then saves the whole report
  with `status: "published"` and emits the same counters.

Neither write carries a `status != "published"` predicate, so the gap between
the read and the write is a TOCTOU window: a double-click or two concurrent
head tabs both pass the check, both rebuild the snapshot, both increment
`customreportReportsSubmittedTotal` and
`customreportPeriodStateTransitionsTotal`, corrupting the on-time-ratio gauge
numerator.

Separately, `review.dashboard` already resolves the current open/reopened
period from the database (newest `periodStatus in ("open","reopened")` with
`periodStart <= now`), but `review.publish` and `review.assembledReport` still
read `ctx.session.activeReportId` from the JWT, which is baked at login and can
point at an older period.

## Goals / Non-Goals

**Goals:**

- Make each publish write a conditional compare-and-set that transitions a
  period at most once under concurrency.
- Gate the snapshot rebuild, ingestion enqueue, and counter increments on the
  compare-and-set having transitioned exactly one row.
- Resolve the `review.publish` / `review.assembledReport` target from the
  database, matching `review.dashboard`.

**Non-Goals:**

- Merging the two publish code paths into one.
- Group-scope authorization of the publish target
  (`scope-period-lifecycle-authz`).
- A database uniqueness constraint on the period
  (`period-uniqueness-db-constraint`).

## Decisions

### 1. Compare-and-set via `updateMany` + count, snapshot read after

`Prisma.report.update({ where: { id } })` cannot express a guarded predicate
beyond the unique key and throws when no row matches. The compare-and-set uses
`tx.report.updateMany({ where: { id, periodStatus: { not: "published" } }, data: buildTransition("publish", …) })`,
which returns `{ count }`.

- `count === 0` → another publish won the race (or the period is already
  published): abort the transaction body as a no-op, return a "did not
  transition" result.
- `count === 1` → read the updated row (`tx.report.findUniqueOrThrow` with
  `reportFullIncludeForSnapshot`) and write the snapshot in the SAME
  transaction, exactly as today.

The field set still comes entirely from `buildTransition`, preserving the
`period-dual-state` "single transition writer" invariant; only the `WHERE`
predicate and the return shape change.

Alternative considered: keep `update` and catch the "already published" via a
`SELECT … FOR UPDATE` row lock. Rejected — heavier, and `updateMany`'s atomic
predicate is the idiomatic single-statement compare-and-set.

### 2. Publication path returns a transitioned flag

`PublicationService.publishReport` keeps its fast-path
`status === "published"` rejection, but the underlying write becomes
conditional (the repository save applies only to a not-published row and
reports whether it transitioned). The service rebuilds the snapshot, enqueues
ingestion, and increments counters only when the write transitioned the row;
a zero-transition result returns the already-published assembled report (or a
domain "already published" error), never a second snapshot rebuild.

### 3. Counter emission keyed on the transition count

Both services move the two `.inc()` calls behind `if (count === 1)`. This is
the `manual-publish-telemetry` MODIFIED requirement: redundant publishes emit
nothing.

### 4. Database-resolved publish target

`review.publish` and `review.assembledReport` adopt the exact query
`review.dashboard` uses to resolve the open/reopened period, replacing
`ctx.session.activeReportId`. When the query returns nothing they raise a
domain "no active period" error mapped to a tRPC error, instead of acting on a
stale id.

## Risks / Trade-offs

- **The dual-state CI gate matches `report.update` / `report.create`, not
  `report.updateMany`.** → A raw `updateMany` of lifecycle fields could slip
  the gate. Mitigation: the publish `updateMany` still sources its `data` from
  `buildTransition`; extend the gate matcher to cover `updateMany` (or add a
  reviewed call-site note) so the invariant stays machine-checked.
- **`updateMany` then `findUniqueOrThrow` is two statements, not one.** →
  Both run inside the existing `$transaction`, so the snapshot stays atomic
  with the transition; the `count` from the first statement is the authority
  on whether to proceed.
- **DB-resolved target changes which period a stale session publishes.** →
  This is the intended fix; it aligns publish with the already-shipped
  `review.dashboard` resolution, so head behaviour becomes consistent, not
  surprising.

## Migration Plan

- No schema change, no migration (MVP phase; the publish field set is
  unchanged).
- Pure server-side behaviour change; no client contract change for
  `review.publish` (same input/none, same success shape) beyond a clearer
  "no active period" / "already published" error.
- Rollback: revert the service/repository/router edits; no data migration to
  undo.

## Open Questions

- Should a zero-transition `review.publish` return the already-published
  assembled report (idempotent success) or a domain "already published" error?
  The spec allows either; pick one consistently across both publish paths in
  implementation and cover it with a test.
