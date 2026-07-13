## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

In `draftSaveSchema` (`packages/shared/src/schemas/section.schema.ts`), the
`items`, `risks`, `decisions`, and `activityStatuses` arrays all carry
`.max(MAX_RECORDS_PER_SECTION_SAVE)`, but the sibling `projectStatuses` and
`stageStatuses` arrays do not. `submitSectionSchema`'s `projectStatuses`
override repeats the same gap. Both schemas back a live tRPC input reachable
by any lead, so an unbounded `projectStatuses`/`stageStatuses` array bypasses
the pathological-array guard the other four arrays already enforce and feeds
an O(projects × statuses) server-side scan. Real assignments naturally bound
these arrays today, so exploitability is low, but the guard is missing where
every sibling array already has it — a defense-in-depth gap, not a live
incident.

## What Changes

- `packages/shared/src/schemas/section.schema.ts`: add
  `.max(MAX_RECORDS_PER_SECTION_SAVE)` to `projectStatuses` and
  `stageStatuses` in `draftSaveSchema`, matching `items`/`risks`/`decisions`/
  `activityStatuses`.
- Add the same `.max(MAX_RECORDS_PER_SECTION_SAVE)` bound to the
  `projectStatuses` override in `submitSectionSchema` (its `stageStatuses`
  is inherited unchanged from `draftSaveSchema`, so it picks up the bound
  automatically once the base schema is fixed).
- No behavior change for any payload within the existing bound; only
  payloads exceeding 100 `projectStatuses` or `stageStatuses` entries start
  being rejected, matching the existing rejection behavior of the sibling
  arrays.
