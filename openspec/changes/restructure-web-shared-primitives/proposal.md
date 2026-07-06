## Why

Parent `restructure-directory-architecture` task 3.1. The flat
`apps/web/src/components/` root still held business-agnostic primitives and a
`components/ui/` bucket. Per `docs/architecture/mapping/` (web-core, web-comp-ui,
missing-singles) these graduate to `shared/` — the FSD business-agnostic layer —
leaving `components/` with only the deferred `slides/` tree and the tiny `dev/`
(a later slice).

## What Changes

- Relocate the loose root primitives to `shared/ui/` (filenames unchanged):
  `error-boundary`, `forbidden-page` (+ test + snapshot), `role-gate` (+ test),
  `agentation-devtools`, and the cross-cutting `coming-soon-style.test.tsx`
  source-scan test.
- Relocate `components/ui/*` to `shared/ui/`: `confirmation-dialog` (+ test),
  `sdlc-tooltip`.
- Relocate `web-vitals-reporter.tsx` to a new `features/telemetry/ui/` slice
  (its own web telemetry domain per the mapping).
- Reroute all consumers (the app-wide root/segment layouts, several feature
  slices, and the two deferred-`slides/` files that import `sdlc-tooltip`).
- Fix the moved `coming-soon-style.test.tsx` path anchors: it scans source by
  filesystem path relative to its own location, so the `+1` directory depth
  (`components/` → `shared/ui/`) is applied to its `repoRoot` and control-file joins.
- Remove the emptied `components/ui/` and `components/__snapshots__/` directories.
- **Behavior-neutral**: pure relocation + import reroute + test-anchor depth fix.

## Non-goals

- No component change. No move of `dev/` (a later slice) or `slides/` (deferred).
  No `webSlices`/zone-5 change (shared/ + the new single-file telemetry slice have
  no cross-slice edges to enforce).

## Impact

- Affected code: ~9 primitives → `shared/ui/`, 1 → `features/telemetry/ui/`; ~16
  rerouted consumers incl. two `slides/` files (owner-approved, same basis as the
  lead dissolve); the emptied `components/ui/` + `components/__snapshots__/`.
- Parent: `restructure-directory-architecture` task 3.1. Mappings: web-core,
  web-comp-ui, missing-singles (2026-07-02).
- No load-bearing invariant touched.
- Verified: cold `tsc` 0, full web eslint clean, full web suite 1567, and
  live-verified from source — `/` (root layout with the moved web-vitals-reporter
  - role-gate), `/reports`, `/head/report/[id]` all HTTP 200, no webpack 500.
