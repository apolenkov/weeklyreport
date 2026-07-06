## Why

Parent `restructure-directory-architecture` task 3.1. With `features/report-sections/`
now created by the lead dissolve, the head report shell can graduate into it. Per
`docs/architecture/mapping/missing-singles-2026-07-02.md`, `head-report-shell.tsx`
is a report-sections-domain page-level shell (composes report-shell primitives +
weekly-report/period/slides UI), so its home is `features/report-sections/ui/`, not
a standalone `head` slice.

## What Changes

- Relocate `components/head/head-report-shell.tsx` (+ co-located test) to
  `features/report-sections/ui/`, filename unchanged. Its imports are rewritten to
  the new relative depths: same-slice `mock-data` → `../model/mock-data`, sibling
  slice `period-navigator` → `../../period/ui/period-navigator`, and the still-legacy
  `weekly-report`/`slides` consumers via `../../../components/*` (those relocate in
  their own later slices).
- Reroute the two consumers `app/(app)/head/report/[reportId]/page.tsx` + its test.
- Remove the emptied `components/head/` directory.
- **Behavior-neutral**: pure relocation + import reroute.

## Non-goals

- No component change. No move of the `weekly-report`/`slides` deps it imports
  (their own later slices). No `webSlices`/zone-5 change (report-sections stays
  unenforced per the lead-dissolve precedent).

## Impact

- Affected code: `features/report-sections/ui/head-report-shell.{tsx,test.tsx}`
  (new), the deleted `components/head/` tree, two rerouted consumer imports.
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/missing-singles-2026-07-02.md`.
- No load-bearing invariant touched (read path presentational shell).
- Verified: cold `tsc` 0, full web suite 1567, focused eslint clean. The head
  report route was already live-verified 200 during the lead dissolve.
