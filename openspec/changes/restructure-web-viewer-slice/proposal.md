## Why

Parent `restructure-directory-architecture` task 3.1. The viewer report shell is
the last file in `components/viewer/`. Per
`docs/architecture/mapping/missing-singles-2026-07-02.md` it becomes its own
`features/viewer/` slice (the canonical-domain table lists `viewer` as a standalone
domain).

**Domain note (owner-reversible):** the source catalog labelled this file's domain
`review`, but the grouping-rules canonical table lists `viewer` as its own domain
and the file already lived in `components/viewer/`. This change treats the catalog's
`review` as the finer label collapsing to canonical `viewer`, so it lands in
`features/viewer/ui/`, not folded into `features/review/`. Flag if the intent was
the review slice.

## What Changes

- Relocate `components/viewer/viewer-report-shell.tsx` (+ co-located test) to the
  new `features/viewer/ui/`, filename unchanged. Imports rewritten to new depths:
  sibling slices `../../period/ui/*`, `../../report-sections/model/*`; legacy
  `../../../components/{slides,weekly-report}/*` and `../../../{lib,shared}/*`.
- Reroute the two consumers `app/(app)/reports/[reportId]/page.tsx` + test.
- Remove the emptied `components/viewer/` directory.
- **Behavior-neutral**: pure relocation + import reroute.

## Non-goals

- No component change. No move of its `slides`/`weekly-report` deps (their own
  later slices). No `webSlices`/zone-5 change (deferred boundaries slice).

## Impact

- Affected code: `features/viewer/ui/viewer-report-shell.{tsx,test.tsx}` (new),
  the deleted `components/viewer/` tree, two rerouted consumer imports.
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/missing-singles-2026-07-02.md`.
- No load-bearing invariant touched (read path presentational shell).
- Verified: cold `tsc` 0, full web suite 1567, focused eslint clean. The viewer
  report route (`/reports/[id]`) renders the same shell already exercised by the
  reports surface.
