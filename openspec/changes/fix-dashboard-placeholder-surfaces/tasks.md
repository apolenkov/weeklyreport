# Tasks

## 1. Characterization pins (current behavior, before touching anything)

- [ ] 1.1 Add a test asserting the bfcache-recovery script's current
      selector string (`[data-dashboard-loading='true']`) never matches any
      rendered dashboard DOM today — pins the dead-code finding before the
      fix changes it.
- [ ] 1.2 Add a test pinning `buildKpiData(...)` returning
      `lastWeekSubmitted: 0, lastWeekTotal: 0` today, and `KpiCards`
      rendering literal text `Last week 0/0` for that input — pins the
      fabricated-zero finding before the fix removes it.

## 2. Fix the loading-state selector

- [ ] 2.1 Render a real `data-dashboard-loading` attribute (or equivalent
      queryable marker) on the dashboard root while any of the kpi / leads /
      blocked panels is in its loading state.
- [ ] 2.2 Update the bfcache-recovery script in
      `apps/web/src/app/(app)/head/dashboard/page.tsx` to query that real
      marker.
- [ ] 2.3 Update/replace the test from 1.1 to assert the new marker renders
      during loading and the selector matches it.

## 3. Remove the fabricated "Last week 0/0" KPI

- [ ] 3.1 Remove `lastWeekSubmitted` / `lastWeekTotal` hardcoded zeros from
      `buildKpiData` in `dashboard-kpi.ts`; update the `KpiData` type in
      `dashboard.ts` to drop the two dead numeric fields (or replace them
      with an explicit unavailable/boolean signal — no fake number).
- [ ] 3.2 Update `KpiCards` in `kpi-cards.tsx` to render an explicit
      "not available yet" presentation in place of the numeric comparison
      (ComingSoon-style treatment), never a "0/0" that reads as real data.
- [ ] 3.3 Update the test from 1.2 and `kpi-cards.test.tsx` to assert the
      unavailable presentation instead of the removed literal "0/0" text.

## 4. Cleanup

- [ ] 4.1 Update the stale comment block in `dashboard.ts` describing
      `lastWeekSubmitted`/`lastWeekTotal` to match the new shape.
- [ ] 4.2 Confirm no other consumer reads the removed `KpiData` fields
      (`grep -rn lastWeek apps/web/src`).

## Gates

- [ ] pnpm typecheck
- [ ] pnpm lint
- [ ] pnpm test
