# Proposal

## Why

TASK-503.35 (finding C0679, wave7 review): `listPeriodsByState` in
`apps/api/src/modules/admin/admin-period.queries.ts` filters the whole live
section list once per open period (`liveSections.filter` inside
`for (const reportId of liveIds)`). For P open periods and N section rows the
read model costs O(P×N) in memory on every Admin Periods page.

## What Changes

- Group the fetched live sections by `reportId` once (`Map.groupBy`), then look
  up each open period's sections by id. Each period still receives
  `computeReportProgress` over its own sections and the same expected leads.
- Query shape, the three reads, the published-snapshot path, row order and the
  returned counts are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `weekly-progress-denominator`: the Admin Periods progress figure is derived
  from a single grouping pass over the period sections, not a rescan per period.

## Impact

`apps/api/src/modules/admin/admin-period.queries.ts` and its colocated unit test
`apps/api/src/modules/admin/admin-period.queries.test.ts`. No API contract,
schema, Prisma query or dependency changes. Evidence: TASK-503.35 card
(archive) and the wave7 review result for C0679.
