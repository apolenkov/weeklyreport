## Why

The parent change `restructure-directory-architecture` locked the target web
structure (`app/` routing + `features/<domain>/` slices + `shared/`) and its
machine-enforced import boundaries, then proved the mechanic end-to-end with the
`landing` pilot slice (task 2.1). Task 3.1 of that change mandates that **each
remaining web domain lands its own OpenSpec change**. This is the first such
child slice: it relocates the `analytics` charts domain.

The three chart components still live in the legacy flat `apps/web/src/components/charts/`
tree, so their home is guesswork and no lint zone guards the `analytics` slice
boundary. The per-file placement is already researched and fixed in
`docs/architecture/mapping/web-comp-charts-2026-07-02.md` (source catalog
`docs/architecture/catalog/web-comp-charts-2026-07-02.md`).

## What Changes

- Relocate the three `analytics` chart components from
  `apps/web/src/components/charts/` to `apps/web/src/features/analytics/ui/`,
  filenames unchanged, per the authoritative mapping:
  - `lead-velocity.chart.tsx` (+ its `buildLeadVelocityChartData` builder — travels with the component; rule-of-2 (web) unmet, no `shared/` graduation)
  - `period-comparison.chart.tsx`
  - `traffic-light-history.chart.tsx` (+ its `buildTrafficLightHistoryChartData` builder — travels with the component)
- Move the co-located `charts.test.tsx` alongside its components, preserving the
  relative layout (its `./`-relative imports stay valid, unchanged).
- Add the slice public API barrel `features/analytics/index.ts` exporting exactly
  the three components the one route consumer (`app/(app)/reports/trends/page.tsx`)
  loads; reroute that route's `next/dynamic` imports from the legacy
  `components/charts/*` paths to the barrel.
- Append `analytics` to the `webSlices` array in `eslint.config.ts`; the existing
  `webCrossSliceZones` builder derives the `{ target, from, except: [self] }`
  cross-slice zone automatically — no other eslint edit is needed (no chart file
  carried a complexity/size exemption entry).
- **Behavior-neutral**: no component logic, props, or rendered output changes;
  this is a pure relocation + import reroute.

## Non-goals

- No component logic, styling, or contract change — pure relocation.
- No `model/`/`api/` segment for this slice: all three files are presentational
  `ui/` components; their chart-data builders are not consumed by a second slice,
  so nothing graduates to `src/shared/` (rule-of-2 web unmet).
- No change to the boundary-zone mechanism itself (owned by the parent change);
  this slice only appends its slice name to the existing `webSlices` list.

## Impact

- Affected code: `apps/web/src/features/analytics/**` (new), the deleted
  `apps/web/src/components/charts/` tree, `app/(app)/reports/trends/page.tsx`
  (import reroute), `eslint.config.ts` (one array entry).
- Parent: `restructure-directory-architecture` task 3.1 — this change is that
  task's first web child slice. Mapping:
  `docs/architecture/mapping/web-comp-charts-2026-07-02.md`.
- No load-bearing invariant touched (charts are read-only analytics views; no
  write path, no tRPC middleware chain).
