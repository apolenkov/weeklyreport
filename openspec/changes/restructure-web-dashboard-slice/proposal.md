## Why

The parent change `restructure-directory-architecture` locked the target web
structure (`app/` routing + `features/<domain>/` slices + `shared/`) and its
machine-enforced import boundaries, then proved the mechanic end-to-end with the
`landing` pilot slice. Task 3.1 of that change mandates that **each remaining web
domain lands its own OpenSpec change**; `analytics` and the shared `navigation`
chrome already did. This child slice relocates the `dashboard` domain — the head
dashboard page plus its KPI/alert/blocked-at-risk/reopen/lead-summary cards.

The eleven dashboard components still live in the legacy flat
`apps/web/src/components/dashboard/` tree, so their home is guesswork and no lint
zone guards the `dashboard` slice boundary. The per-file placement is already
researched and fixed in
`docs/architecture/mapping/web-comp-dashboard-2026-07-02.md` (source catalog
`docs/architecture/catalog/web-comp-dashboard-2026-07-02.md`), with
`TARGET-STRUCTURE-2026-07-02.md` as the tie-breaker.

## What Changes

- Relocate the eleven `dashboard` components from
  `apps/web/src/components/dashboard/` to `apps/web/src/features/dashboard/ui/`,
  filenames unchanged, per the authoritative mapping (`Layer` column = `ui`):
  `activity-live-panel`, `alert-bar`, `blocked-at-risk-product-card` (+ its
  co-located `groupByProduct` helper — single small consumer, rule-of-2 (web)
  unmet), `blocked-at-risk-table`, `dashboard-page` (the slice composition root),
  `dashboard-skeleton`, `kpi-cards`, `lead-summary-table`, `remind-lead-button`,
  `reopen-requests-card`, `revoke-lead-button`. Co-located `*.test.tsx` and the
  `__snapshots__/` directory travel with their files.
- Graduate `mock-data.ts` to `apps/web/src/shared/lib/dashboard-mock-data.ts`
  (renamed to avoid colliding with admin's `mock-data.ts`). Its types/consts are
  consumed by the dashboard slice AND the weekly-report feature (grep-verified:
  `weekly-report-page`, `product-accordion`, `portfolio-overview-table`, the print
  template) — ≥2 slices, so rule-of-2 (web) forces it out of the slice into
  `shared/lib/`, the only lawful meeting point for a two-slice-consumer helper.
- Add the slice public API barrel `features/dashboard/index.ts` exporting exactly
  `DashboardPage` — the one thing the sole route consumer
  (`app/(app)/head/dashboard/page.tsx`) loads; reroute that route to the barrel.
- Reroute every remaining consumer of the moved paths: the `mock-data`
  importers (dashboard `kpi-cards`, weekly-report x4 + 2 tests, print template) to
  the new `shared/lib/dashboard-mock-data` path; every dashboard file's upward
  relative imports (`../../lib/*`, `../<sibling-dir>/*`) gain one path segment
  because the slice sits one directory deeper than the legacy tree.
- Append `dashboard` to the `webSlices` array in `eslint.config.ts`; the existing
  `webCrossSliceZones` builder derives the `{ target, from, except: [self] }`
  cross-slice zone automatically. Update the five path-pinned lint exemptions that
  reference `components/dashboard/*` (mock-data x2, dashboard-page x2,
  remind-lead-button) to the new slice / shared paths.
- **Behavior-neutral**: no component logic, props, or rendered output changes;
  this is a pure relocation + import reroute.

## Non-goals

- No component logic, styling, or contract change — pure relocation.
- **Fixture/type split of `mock-data.ts` deferred.** The mapping row suggests
  splitting the legacy mock fixtures out from the live presentation types "at move
  time". That is advisory ("or into test support", "re-check at move time");
  splitting ~870 lines mid-relocation would trade the behavior-neutral principle
  the whole restructure program (and both landed siblings) rests on for scope and
  risk. The file graduates whole to `shared/lib/`; the split, if wanted, is its
  own follow-up change.
- No `model/`/`api/` segment for this slice: every moved file is a presentational
  `ui/` component. `blocked-at-risk-product-card`'s `groupByProduct` helper and
  `kpi-cards`'s `KpiData` type source do not each gain a second in-slice home, so
  nothing else graduates to `src/shared/`.
- No change to the boundary-zone mechanism itself (owned by the parent change);
  this slice only appends its slice name to the existing `webSlices` list.

## Impact

- Affected code: `apps/web/src/features/dashboard/**` (new),
  `apps/web/src/shared/lib/dashboard-mock-data.ts` (new), the deleted
  `apps/web/src/components/dashboard/` tree, `app/(app)/head/dashboard/page.tsx`
  (barrel reroute), the weekly-report + print + kpi-cards mock-data consumers
  (path reroute), `eslint.config.ts` (one array entry + five exemption paths).
- Parent: `restructure-directory-architecture` task 3.1 — this change is that
  task's third web child slice (after `analytics` and `navigation`). Mapping:
  `docs/architecture/mapping/web-comp-dashboard-2026-07-02.md`.
- No load-bearing invariant touched (dashboard is a read-model surface;
  reopen/remind/revoke mutations call tRPC inline and are unchanged, no middleware
  chain rewired).
