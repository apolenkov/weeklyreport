# Phase 51-C — Period State-Machine column

**Status:** ready
**Depends on:** 51-A (new fields), 50-B (archived flag exists)
**Requirement:** explicit periodState enum replacing the implicit (status + periodStatus + archived) tuple

## Goal

Add `Report.periodState: PeriodState` enum
(`scheduled | open | published | archived`). Backfill from current
tuple. Reads route through the new column; writes update both old

- new (compatibility window of one release).

## Acceptance Criteria

- Prisma enum `PeriodState { SCHEDULED, OPEN, PUBLISHED, ARCHIVED }`.
- `Report.periodState: PeriodState @default(OPEN)` — new column,
  index on `(periodState, periodStart desc)`.
- Migration backfills:
  - `archived=true` → `ARCHIVED`
  - `status=published` AND `archived=false` → `PUBLISHED`
  - `status=draft` AND `periodStart > now` → `SCHEDULED`
  - else → `OPEN`
- Shared zod `reportPeriodSchema` gains
  `periodState: z.enum(['scheduled', 'open', 'published', 'archived'])`.
- Service methods (publish, reopen, archive) update both
  `periodState` AND legacy fields atomically.
- 50-B cron jobs (PeriodCreator, AutoPublisher, AutoArchiver) move
  the state via `periodState` (PeriodCreator → SCHEDULED or OPEN;
  AutoPublisher → PUBLISHED; AutoArchiver → ARCHIVED).
- 51-B admin actions consume `periodState` for menu logic.
- Tests: backfill matrix (every input row → expected periodState),
  service transitions, cron transitions.

## Steps

1. Schema additions.
2. Migration with backfill SQL.
3. Apply + regenerate Prisma.
4. Service updates: every publish/reopen/archive site writes both
   old fields AND `periodState`.
5. Cron updates: 50-B processors flip `periodState` instead of
   legacy fields.
6. Read-side updates: dashboard, archive list, admin periods tab —
   filter by `periodState`.
7. Adapter pattern documented in
   `apps/api/src/modules/weekly-report/period-state.ts`:
   ```ts
   export function legacyTupleToState(report: { status, archived }): PeriodState { … }
   export function stateToLegacyTuple(state: PeriodState): { status, archived } { … }
   ```
8. Tests + verify.

## Commit

`feat(api,shared): UFB-053 — Period state-machine column (scheduled/open/published/archived) (51-C)`

Co-Authored-By: Claude Opus 4.7 (1M context)
