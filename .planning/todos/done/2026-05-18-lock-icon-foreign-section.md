# TODO(LOCK-01): Lock icon on foreign section in lead-form

## Status: pending

## Context

When Vasily opens `/lead/report?authorId=<BORIS_ID>`, the frontend sets
`isPinnedAuthorView = true` and the entire section renders read-only (Add/Edit
buttons hidden). However, there is no visual indicator (lock icon, badge, or
border) on the section header or individual cards to show that this is a
_foreign author's section_, not Vasily's own read-only view.

## Data already in place (2026-05-18)

- Boris's `ReportSection` (id `...0407`) exists in `REPORT_ACTIVE` with
  `authorId = LEAD_MOBILE_PM` and status `draft`.
- Boris has `StageAssignment` on `PROD_CRM_SALES/STAGE_PLAN`, so
  `data.products` includes `PROD_CRM_SALES` in his section.
- Boris's section has 1 Item + 1 Risk on `PROD_CRM_SALES`.
- `isPinnedAuthorView` correctly sets `isReadOnly = true` at
  `apps/web/src/components/lead/lead-form.tsx:830`.

## What's missing

A visual lock / badge on the section header when `isPinnedAuthorView === true`
to communicate «you are viewing another person's work».

## Proposed implementation

1. In `lead-form.tsx`, when `isPinnedAuthorView === true`, pass an additional
   prop (e.g. `foreignAuthorName`) to `AccordionSection` or inject a
   `<span className="foreign-author-badge">` into the `actions` slot of
   `AccordionSection`.
2. The badge shows: `🔒 Boris S.` or a lock SVG + author name.
3. Alternatively: a top-of-section banner «Viewing section by <name>» styled
   distinctly from the normal read-only banner.

## Marker in code

See `TODO(LOCK-01)` in `apps/web/src/components/lead/lead-form.tsx`

## Out of scope in Phase 61 / small-MVP seed patch

This feature was intentionally deferred. The seed data is ready; the UI
indicator is a separate feature track.
