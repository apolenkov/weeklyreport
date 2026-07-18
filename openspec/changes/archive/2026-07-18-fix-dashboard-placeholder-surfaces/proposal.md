## Why

Two surfaces on the head dashboard silently lie to the user.

`apps/web/src/app/(app)/head/dashboard/page.tsx:13` injects a bfcache-recovery
script that queries `document.querySelector("[data-dashboard-loading='true']")`
to decide whether a stale back-forward-restored page needs a hard reload. No
component in `apps/web/src/features/dashboard/` renders that attribute — the
loading panels (`DashboardPanelLoading` in
`apps/web/src/features/dashboard/ui/dashboard-panel-state.tsx:20`) render
`data-testid="dashboard-<kind>-loading"` instead. The selector can never
match, so `if (!document.querySelector(...)) return;` always returns early
and the recovery reload never fires. The script is dead code that looks like
a working safety net.

`apps/web/src/features/dashboard/model/dashboard-kpi.ts:65-66` hardcodes
`lastWeekSubmitted: 0` and `lastWeekTotal: 0` with a comment admitting "no
equivalent in any v5.0 read model, so they default to 0/0". `KpiCards`
(`apps/web/src/features/dashboard/ui/kpi-cards.tsx:50`) renders this as
`Last week {lastWeekSubmitted}/{lastWeekTotal}` — a real, confident-looking
metric that is always "Last week 0/0" regardless of actual history. A head
reading the dashboard has no way to tell "0 submitted last week" (a real
signal) from "we don't track this yet" (the actual truth).

## What Changes

- Render a real, queryable loading-state marker on the head dashboard root
  while any of the three panels (kpi / leads / blocked) are loading, and
  point the bfcache-recovery script's selector at that real marker instead
  of the nonexistent `[data-dashboard-loading='true']`.
- Remove the hardcoded `lastWeekSubmitted` / `lastWeekTotal` zeros from
  `buildKpiData` and stop rendering a fabricated "Last week 0/0" KPI value;
  replace it with an explicit "not available yet" presentation
  (ComingSoon-style) so the absence of last-week data reads as unavailable,
  never as a real zero.
- Update `KpiData` / `KpiCards` and their tests to drop the two dead numeric
  fields (or repurpose them as an explicit unavailable-state flag) so the
  type system can no longer carry a fake zero as if it were live data.

## Capabilities

### Modified Capabilities

- `head-dashboard-clarity` — dashboard loading/KPI surfaces must reflect real, queryable state, never a fabricated marker or number.

## Impact

- `apps/web/src/app/(app)/head/dashboard/page.tsx` — bfcache-recovery
  selector wired to a real DOM marker.
- `apps/web/src/features/dashboard/ui/dashboard-content.tsx` (or the
  dashboard root component that composes the three panels) — renders the
  new loading marker attribute while any panel is loading.
- `apps/web/src/features/dashboard/model/dashboard-kpi.ts` — drop the
  hardcoded `lastWeekSubmitted`/`lastWeekTotal` zeros.
- `apps/web/src/features/dashboard/model/dashboard.ts` — `KpiData` shape.
- `apps/web/src/features/dashboard/ui/kpi-cards.tsx` — render an
  unavailable state instead of "Last week 0/0".
- Associated tests: `dashboard-page.test.tsx`, `kpi-cards.test.tsx`, and any
  new characterization test for the bfcache-recovery script.

## Non-goals

- Not building a real "last week" comparison metric — no v5.0 read model
  carries prior-period submission counts; that is a separate backend change.
- Not changing the bfcache-recovery script's overall strategy (pageshow +
  history-restore detection) — only the selector it queries.
- Not touching any other dashboard panel's error/retry UX.
