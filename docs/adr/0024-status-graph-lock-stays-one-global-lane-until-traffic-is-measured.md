# The status-graph lock stays one global lane until traffic is measured

**Status:** accepted
**Date:** 2026-11-02
**Superseded-by:** None

## Context

Writes that derive child status rows from the current assignment graph take one
PostgreSQL advisory transaction lock, `STATUS_GRAPH_ADVISORY_LOCK_KEY`, in
`apps/api/src/lib/status-graph-lock.ts`. The lane is global on purpose: a new
report can appear after another writer's candidate scan, so a narrower key
would leave a phantom gap unless every report-creation path joined it.

TASK-503.27 asked for load and SLO evidence for this blocking. None exists: the
product has no production traffic yet, and any number written down now would be
invented. On 2026-10-27 the gate decided, with the owner's right to revert, that
the current behaviour is acceptable until real traffic exists.

## Decision

The lock stays one global lane. No load figure, SLO, lock timeout or queue
bound is added without a measurement. `packages/report-persistence` owns the
blocking policy for report persistence; a change to lock scope, order or
duration is made against that package and its callers. The lock helper stays in
`apps/api/src/lib/status-graph-lock.ts`; moving it is outside this decision.

## Alternatives

- A narrower per-report lock key: rejected, it reopens the phantom-gap race
  described above unless every report-creation path joins it.
- A documented SLO or lock timeout now: rejected, there is no traffic to
  measure and an unmeasured bound would pass for evidence.

## Consequences

Contention is not measured today. When real traffic exists, measure blocking
with `pg_locks` and `pg_blocking_pids` on a guarded PostgreSQL target; the
fixtures in `apps/api/src/modules/period/infrastructure/period.single-active-reopen.integration.test.ts`
(lines 255-371) already show how to hold a lock and observe the blocked session.
Only a measured conflict reopens this record.
