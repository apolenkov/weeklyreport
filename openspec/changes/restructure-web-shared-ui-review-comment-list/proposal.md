## Why

Parent `restructure-directory-architecture` task 3.1 relocates the remaining web
domains one slice at a time. `components/review/review-comment-list.tsx` is the
last file in the legacy `components/review/` tree — a display-only comment list
consumed by two different slices: `weekly-report` (`record-comments.tsx`) and
`report-sections`/lead (`lead-review-feedback.tsx`). Two slice consumers trip
rule-of-2 (web), and neither slice may import the other (zone 5), so the only
lawful home is `shared/ui/`, per the authoritative mapping
`docs/architecture/mapping/missing-singles-2026-07-02.md`.

## What Changes

- Relocate `components/review/review-comment-list.tsx` to
  `apps/web/src/shared/ui/review-comment-list.tsx`, filename unchanged. The file
  has no relative imports and stays two directories under `src/`, so nothing in
  it changes.
- Reroute the two consumers to import from `shared/ui/*` directly (no barrel):
  `components/weekly-report/review/record-comments.tsx` and
  `components/lead/lead-review-feedback.tsx`.
- Remove the emptied `components/review/` directory (this was its only file).
- **Behavior-neutral**: pure relocation + import reroute.

## Non-goals

- No component change — pure relocation.
- No `features/review` slice claim: two slice consumers make it shared, not
  review-owned.
- No relocation of the still-legacy consumers (`weekly-report`, `lead`) — they
  reroute to the stable `shared/ui/` path this pass and move in their own slices.
- No `eslint.config.ts` change: the file carries no path-pinned exemption and
  `shared/` is not a feature slice.

## Impact

- Affected code: `apps/web/src/shared/ui/review-comment-list.tsx` (new), the
  deleted `components/review/` tree, two rerouted consumer imports.
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/missing-singles-2026-07-02.md`.
- No load-bearing invariant touched (read-only presentational list).
