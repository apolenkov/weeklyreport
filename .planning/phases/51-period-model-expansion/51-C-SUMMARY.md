---
phase: 51
plan: 51-C
subsystem: schema + api (state-machine, schedulers, audit)
tags: [UFB-053, PeriodState, period-lifecycle, state-machine, schedulers]
requires: [51-A, 50-B]
provides:
  [
    Report.periodState enum column,
    PeriodState wire type,
    legacy-tuple ↔ state adapter,
    state-transition audit payload,
    state writes on every lifecycle path,
  ]
affects:
  [
    prisma/schema.prisma,
    packages/shared/src/schemas/report.ts,
    apps/api/src/lib/audit-logger.ts,
    apps/api/src/modules/weekly-report/period-state.ts,
    apps/api/src/modules/period/period-creator.scheduler.ts,
    apps/api/src/modules/period/auto-publisher.scheduler.ts,
    apps/api/src/modules/period/auto-archiver.scheduler.ts,
    apps/api/src/modules/period/period.prisma-repository.ts,
    apps/api/src/modules/publication/publication.prisma-repository.ts,
  ]
tech_added: []
key_files_created:
  - prisma/migrations/20260511000000_51c_period_state/migration.sql
  - apps/api/src/modules/weekly-report/period-state.ts
  - apps/api/src/modules/weekly-report/period-state.test.ts
key_files_modified:
  - prisma/schema.prisma
  - packages/shared/src/schemas/report.ts
  - packages/shared/src/schemas/__tests__/report.test.ts
  - apps/api/src/lib/audit-logger.ts
  - apps/api/src/lib/audit-logger.test.ts
  - apps/api/src/modules/period/period-creator.scheduler.ts
  - apps/api/src/modules/period/period-creator.scheduler.test.ts
  - apps/api/src/modules/period/auto-publisher.scheduler.ts
  - apps/api/src/modules/period/auto-publisher.scheduler.test.ts
  - apps/api/src/modules/period/auto-archiver.scheduler.ts
  - apps/api/src/modules/period/auto-archiver.scheduler.test.ts
  - apps/api/src/modules/period/period.prisma-repository.ts
  - apps/api/src/modules/publication/publication.prisma-repository.ts
decisions:
  - "Lowercase Prisma enum PeriodState { scheduled, open, published, archived } to match the ReportStatus/PeriodStatus precedent (screaming-snake enums in this schema are categorically different — they carry metadata, not lifecycle)."
  - "Per orchestrator override: backfill produces only OPEN | PUBLISHED | ARCHIVED. The SCHEDULED state is reserved for future periods minted by the PeriodCreator scheduler and is never derived from the legacy tuple."
  - "Legacy fields (status, archived, periodStatus, autoPublished, autoArchived) preserved during the one-release compatibility window; writers update both the new column and the legacy tuple atomically."
  - "reportPeriodSchema / periodReadModelSchema gain periodState as OPTIONAL (mirrors the 50-B `late` back-compat pattern). 51-B switches the read paths."
  - "On reopen, periodState reverts to 'open' while periodStatus stays 'reopened'. The two state machines are intentionally distinct (see Open Questions)."
  - "Adapter (legacyTupleToState / stateToLegacyTuple) lives in weekly-report/period-state.ts per the plan's directory hint; reverse map is intentionally lossy (scheduled and open both project to status='draft', archived=false on the legacy side)."
  - "Audit envelopes for the three scheduler events gain {from, to} state-transition payload. PeriodAutoCreateInput uses from=null for the fresh-create case so SIEM rules can filter on `(from, to)` uniformly."
  - "Read paths (dashboard, archive list, admin periods tab) NOT touched — per the prompt's '51-C is backend-only state-machine + tests'. 51-B owns the read-side swap."
metrics:
  duration_min: 32
  tasks_completed: 5
  files_created: 3
  files_modified: 13
  commits: 4
  api_unit_tests: 808 # +15 from 793 baseline (14 adapter + 1 sweep test; envelope shape updates compensated existing assertions)
  api_integration_tests: 66 # unchanged
  shared_tests: 482 # +9 from 473 baseline (UFB-053 periodStateSchema contract tests)
  web_tests: 322 # unchanged
completed: 2026-05-11
---

# Phase 51 Plan C: Period State-Machine Column Summary

**One-liner:** `Report.periodState: PeriodState` enum column lands with a
deterministic backfill (`archived`→archived, `status='published'`→published,
else open — never scheduled), and the three 50-B schedulers + manual
publish/reopen paths now write both the new column and the legacy
`(status, archived, periodStatus)` tuple atomically, with state-transition
audit payloads (`{from, to}`) on every cron-driven event.

## What was built

**Schema (commit `7693355`).** Migration
`20260511000000_51c_period_state` introduces the lowercase Prisma enum
`PeriodState { scheduled, open, published, archived }` and adds
`Report.periodState` with a column-level default of `'open'`. The
backfill `UPDATE` statements run in archived-wins-over-published order
so existing historical rows land cleanly: archived→archived,
published→published, else open. A composite index
`(periodState, periodStart DESC)` mirrors the legacy
`(status, periodStart DESC)` shape so 51-B's read-side swap will not
introduce an index gap. Applied to both `customreport` and
`customreport_test` via `prisma migrate deploy`; Prisma client
regenerated in the api container and the api service restarted.

**Shared zod (commit `185ec8d`).** New `periodStateSchema = z.enum([…])`
matches the wire format of the lowercase Prisma enum.
`reportPeriodSchema` and `periodReadModelSchema` gain
`periodState: periodStateSchema.optional()` — the optional shape
follows the 50-B `late` precedent so pre-51-C fixtures, admin
snapshots, and tRPC payloads still parse during the compatibility
window. Type export `PeriodState` joins the shared surface alongside
`PeriodStatus`. +9 contract tests cover the enum surface (incl. an
explicit rejection of `'reopened'`, which lives on `periodStatus` only)
and back-compat round-trip of `reportPeriodSchema` with and without
the new field.

**Adapter (commit `fbab5e1`).**
`apps/api/src/modules/weekly-report/period-state.ts` ships three
helpers:

```
legacyTupleToState({status, archived}) → PeriodState
stateToLegacyTuple(PeriodState)        → {status, archived}
initialPeriodState(periodStart, now)   → 'scheduled' | 'open'
```

The forward map (`legacy → state`) implements the same precedence as
the migration backfill: archived wins, then published, then open;
'scheduled' is never produced. The reverse map is intentionally lossy
— `scheduled` and `open` both project to `(status: 'draft',
archived: false)` because the legacy tuple cannot distinguish them.
That asymmetry is the whole reason the new column exists, and it is
encoded as a test case so future maintainers cannot accidentally
"fix" it. `initialPeriodState` drives the deterministic
SCHEDULED→OPEN flip inside the creator scheduler. +14 unit tests
cover every branch and round-trip invariant.

**Audit envelope + schedulers + service writers (commit `ce6e52f`).**

- `PeriodAutoCreateInput`, `PeriodAutoPublishInput`, and
  `PeriodAutoArchiveInput` gain `{from: PeriodState | null, to:
PeriodState}`. The `from = null` shape on create makes
  `(from, to)`-based SIEM rules uniform across the three cron events.
  Both `createAuditLogger` and `createNullAuditLogger` carry the new
  fields; the unit tests assert the new envelope on every emitted
  branch.
- `PeriodCreatorScheduler.runOnce` now executes a SCHEDULED→OPEN
  sweep at the top of every tick (after the disabled gate): any
  `periodState='scheduled' AND periodStart <= now` rows flip to
  `'open'` in a single `updateMany`. On create, `initialPeriodState`
  selects `'scheduled'` vs `'open'` from `(periodStart, now)`; the
  audit envelope carries `{from: null, to: <chosen-state>}`.
- `AutoPublisherScheduler.runOnce` runs an additive
  `update({periodState: 'published', autoPublished: true})` after
  `publicationService.publishAuto` succeeds. The audit envelope carries
  `{from: 'open', to: 'published'}`.
- `AutoArchiverScheduler.runOnce` widens its single `update` call to
  `{archived: true, periodState: 'archived', autoArchived: true}` so
  the legacy boolean, the new state, and the 51-A audit flag all flip
  atomically. The audit envelope carries `{from: 'published', to:
'archived'}`.
- `period.prisma-repository.publishPeriod` (head-driven publish) and
  `publication.prisma-repository.saveAssembledReport` (head review
  flow + auto-publish) both mirror the legacy `status` write into
  `periodState` in the same `update` call.
- `period.prisma-repository.reopenPeriod` reverts `periodState` to
  `'open'` while keeping `periodStatus = 'reopened'`. See Open
  Questions below for the asymmetry rationale.

## Verification

```
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c 'SELECT enum_range(NULL::"PeriodState");'
  → {scheduled,open,published,archived}

docker exec customreport-postgres-1 psql -U customreport -d customreport -c '\d "Report"'
  → periodState column present with default 'open'
  → composite index Report_periodState_periodStart_idx visible

pnpm --filter @customreport/shared test
  → 482 passing (was 473, +9 UFB-053 contract tests)

pnpm --filter @customreport/api test
  → 808 passing (was 793, +15 net: 14 adapter + 1 sweep test;
    existing envelope-shape assertions updated in-place)

pnpm --filter @customreport/api test:integration
  → 66 passing (unchanged — integration tests do not assert on the new
    column yet; they fall through the optional-zod branch)

pnpm --filter @customreport/web test
  → 322 passing (unchanged — 51-C is backend-only per prompt)

pnpm --filter @customreport/api exec tsc --noEmit  → exit 0
pnpm --filter @customreport/web exec tsc --noEmit  → exit 0
pnpm --filter @customreport/shared exec tsc --noEmit → exit 0

docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma generate"
  → Generated Prisma Client (v7.6.0)
docker compose restart api  → container healthy
```

## Deviations from Plan

**Followed the orchestrator-prompt overrides where it diverged from the
plan:**

1. **Backfill never produces `SCHEDULED`.** Plan section "Acceptance
   Criteria" lists `status='draft' AND periodStart > now → SCHEDULED`.
   Prompt explicitly says: "No row should land in SCHEDULED via backfill
   — that state is only for future periods auto-created by 50-B
   period-creator.scheduler." The migration follows the prompt: only
   `archived` / `published` / `open` are produced; the SCHEDULED state
   is reserved for future periods minted ahead of their start day by
   the creator scheduler.

2. **Lowercase Prisma enum + lowercase zod.** Plan acceptance criteria
   write `PeriodState { SCHEDULED, OPEN, PUBLISHED, ARCHIVED }`
   (screaming-snake). The other status-like enums in this schema
   (`ReportStatus { draft, published }`, `PeriodStatus { open,
published, reopened }`, `ReportSectionStatus`) are all lowercase;
   the screaming-snake enums (`WorkingDays`, `ReminderAudience`) carry
   metadata, not lifecycle. Lowercase keeps the precedent uniform and
   the wire format matches the existing Prisma → zod pipeline (no
   string-case mapper needed).

3. **Read-side wiring deferred to 51-B.** Plan step 6 mentions
   "dashboard, archive list, admin periods tab — filter by
   `periodState`". Prompt explicitly says: "51-C is backend-only
   state-machine + tests... Don't pre-implement UI for 51-B here."
   Read paths stay on the legacy tuple; 51-B owns the swap. The
   composite index is in place so the read-side swap will not bottleneck.

4. **Reopen reverts state to `'open'`, not `'reopened'`.** The plan is
   silent on reopen. The new `PeriodState` enum does not carry a
   `'reopened'` member (per the orchestrator's "states `SCHEDULED |
OPEN | PUBLISHED | ARCHIVED`"). Conservative choice: on reopen,
   `periodState → 'open'` (the closest of the four states to "editable
   again") while `periodStatus → 'reopened'` (separate state machine
   that preserves the reopen flavour for consumers that need to
   discriminate). This is the four-source-conflict tiebreaker called
   out as Open Question below.

5. **`Report.archived` kept, not dropped.** Per the prompt:
   "The existing `Report.archived` boolean from 50-B becomes redundant
   once `state` is added — keep BOTH for backwards compatibility,
   derive `archived = state === ARCHIVED` in the application layer;
   do NOT drop columns." The migration adds, never removes.

### Auto-fixed Issues

None. The existing tests broke at the type level when the audit
envelope gained `{from, to}` and were updated in-place as part of the
same commit — that is the planned envelope migration, not a deviation.
No production-code bugs were uncovered.

## Authentication gates

None — pure schema + api work, no SAML / Keycloak surface touched.

## Open questions

**1. Should `PeriodState` carry a `reopened` member?**

The two-state-machine design (this plan) keeps reopen flavour on
`periodStatus` and routes the lifecycle through `periodState`. The
alternative is a five-member `PeriodState { scheduled, open,
published, archived, reopened }` that collapses both into one column.
Trade-off:

- Two columns (chosen): clean four-member lifecycle enum, reopen flavour
  preserved for audit dashboards. Cost: two writes per reopen, two
  semantics for consumers to learn.
- One column with `reopened`: single source of truth, easier to query.
  Cost: lifecycle enum is no longer a clean DAG (reopened → open vs.
  reopened → published is ambiguous without a separate flag).

Status: deferred. The 51-B admin Periods tab will surface both columns
and the design feedback from that UI will inform whether to collapse.

**2. Should `publication.prisma-repository.saveAssembledReport` ever
write `periodState: 'scheduled'`?**

Currently it writes `'open'` whenever `status === 'draft'`. That is
correct for the common path (head reviews a section, saves, status
stays draft) but technically wrong for the hypothetical case where a
section update arrives for a `scheduled` period that the publisher has
not yet flipped to `open`. The SCHEDULED→OPEN sweep runs daily, so the
worst-case window is 24h; a section update on a scheduled period would
just advance its state by half a day. Documented and accepted as-is —
revisit if 51-B surfaces a UI that allows lead writes on SCHEDULED rows
directly.

## What 51-B will consume

- `Report.periodState` is now the read-side source of truth. The
  composite index `(periodState, periodStart desc)` is in place — 51-B
  can switch every dashboard/archive query to filter on `periodState IN
(…)` without an index gap.
- `reportPeriodSchema.periodState` (optional today) graduates to
  required once every writer is on the new column. 51-B is free to add
  the required projection at the read layer.
- The two-state-machine asymmetry (Open Question 1) needs a UI
  decision: surface `periodState` only, or `periodState` plus a
  "(reopened)" badge derived from `periodStatus`. Recommendation:
  show both with the badge — preserves audit fidelity at zero query
  cost.

## Commits

| #   | Hash      | Scope                                                                |
| --- | --------- | -------------------------------------------------------------------- |
| 1   | `7693355` | schema: `PeriodState` enum + `Report.periodState` column + migration |
| 2   | `185ec8d` | shared: `periodStateSchema` + optional `reportPeriodSchema` field    |
| 3   | `fbab5e1` | api: period-state adapter (legacy tuple ↔ `PeriodState`)             |
| 4   | `ce6e52f` | api: periodState writers + state-transition audit envelope           |

## Self-Check: PASSED

- [x] `prisma/migrations/20260511000000_51c_period_state/migration.sql` exists.
- [x] Commit `7693355` (schema) in `git log`.
- [x] Commit `185ec8d` (shared) in `git log`.
- [x] Commit `fbab5e1` (adapter) in `git log`.
- [x] Commit `ce6e52f` (audit + schedulers) in `git log`.
- [x] `PeriodState` enum visible in postgres (`enum_range`).
- [x] `Report.periodState` column visible with default `'open'`.
- [x] `Report_periodState_periodStart_idx` composite index visible.
- [x] tsc clean on api, web, shared.
- [x] Shared 482, API unit 808, API integration 66, web 322 — all passing.
- [x] api container restarted + healthy after `prisma generate`.
