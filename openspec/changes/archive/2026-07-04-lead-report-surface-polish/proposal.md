# Lead + Head Report Surface Polish (2026-07-02)

## Why

Two live agentation walkthroughs on 2026-07-02 — the lead report surface
(`docs/feedback/lead-surface-annotations-2026-07-02.md`) and the head report
surface (`docs/feedback/head-surface-walkthrough-2026-07-02.md`) — surfaced a
batch of presentation defects on the lead slides, the lead item cards, the lead
action row, and the head dashboard/report. Each is a concrete, reproduced UI
complaint; none needs a schema change. They are collected here as one
frontend-polish change so the surfaces move together and the slide grouping,
card-height, and action-row rules land as durable spec, not one-off tweaks that
regrow on the next sweep.

Scope is the presentation cluster only. The parallel "activity as a first-class
reporting unit" theme (lead annotations A3/D1/D2/D3, head HF2/HF4/HF5) needs a
schema change (`ProjectActivity` 1:N → M:N) and is deliberately OUT — it belongs
to `activity-first-class-reporting-unit`, which this change references but does
not implement.

## What Changes

- **Lead slides — group by product, show the author, no silent overflow**
  (annotations A1, A2, A4). Replace the repeated per-row product pill with one
  product heading per group inside each quadrant; keep the author (lead) identity
  on the slide and read priorities-before-product within a group; keep the
  existing "every row renders, scroll the quadrant, paginate products across the
  carousel — never +N more" overflow contract intact under grouping.
  `lead-unified-slide.tsx`, `status-slide-deck.tsx`, `section-slide-utils.ts`.
- **Lead item cards — uniform height + ellipsis/tooltip** (annotations B1, B2).
  All cards in a section render at one reference height (the empty-state card);
  overflowing text truncates with an ellipsis and keeps the full text on hover.
  `item-card.tsx` (already `line-clamp-3` + `title`; the real gap is the uniform
  height — the card currently grows past its `min-height: 110` floor).
- **Lead "+ Add" — reposition and keep it in slides** (annotations C1, C2). Move
  the quick-add control to sit immediately before the Submit Section primary in
  the document-action group, and render it in slides mode too (today it is gated
  `!isSlidesMode` and disappears). `quick-add-button.tsx`, `lead-form.tsx`.
- **Head dashboard — one reopen surface, not two** (head HF6). The pending-lead
  alert bar and the Reopen Requests card show the same reopen count twice;
  consolidate the reopen count + queue onto the card and drop the alert bar's
  duplicate indicator. `alert-bar.tsx`, `reopen-requests-card.tsx`.
- **Carry-over — automatic on a new period; drop the banner** (head HF10). Copy a
  lead's unfinished prior-period work forward automatically when the new-period
  section is established, and remove the manual "Copy forward unfinished" banner.
  This REVERSES the documented "carry-over stays a conscious head action"
  decision. `carry-over-banner.tsx`, `carry-over.service.ts`, `weekly-report-page.tsx`.
- **Review-acknowledge — move into the publish-and-lock flow** (head HF1). Present
  the head/admin acknowledge control within the Publish & Lock cluster rather than
  as a separate band above the report body; the move does NOT gate publishing.
  `review-acknowledge-bar.tsx`, `weekly-report-page.tsx`.

## Capabilities

### New Capabilities

- `lead-item-card-uniformity`: uniform item-card height (empty-state reference) +
  ellipsis-with-tooltip truncation on the lead form (annotations B1, B2).
- `carry-over-automation`: automatic carry-over of unfinished work on a new
  period + removal of the manual banner (head HF10).
- `review-acknowledge-placement`: the review-acknowledge control lives in the
  publish-and-lock flow, without gating publish (head HF1).

### Modified Capabilities

- `lead-slide-quadrants`: removes the per-row product-badge attribution rule and
  adds product-grouping + a lead → priorities → product reading order; overflow
  contract unchanged (annotations A1, A2, A4).
- `report-toolbar-layout`: adds a stable cross-mode document-action slot for the
  lead "+ Add" quick-add control, ordered before Submit Section (annotations C1, C2).
- `reopen-requests`: consolidates the pending reopen count onto a single surface
  (the Reopen Requests card), dropping the alert-bar duplicate (head HF6).

## Impact

- Web (presentation): `apps/web/src/components/slides/lead-unified-slide.tsx`,
  `status-slide-deck.tsx`, `section-slide-utils.ts`,
  `apps/web/src/components/lead/item-card.tsx`, `quick-add-button.tsx`,
  `lead-form.tsx`, `apps/web/src/components/dashboard/alert-bar.tsx`,
  `reopen-requests-card.tsx`, `dashboard-page.tsx`,
  `apps/web/src/components/weekly-report/carry-over-banner.tsx` (removed),
  `weekly-report-page.tsx`,
  `apps/web/src/components/weekly-report/review/review-acknowledge-bar.tsx`.
- Backend (behavior only, NO schema): the carry-over copy logic
  (`apps/api/src/modules/carry-over/carry-over.service.ts`) gains an automatic
  trigger at new-period section provisioning
  (`apps/api/src/modules/report-sections/ensure-lead-section.ts`). Reuses the
  existing `CarryOverExecution` / `CarryOverRecord` tables and the
  `@@unique([reportSectionId, stableId])` lineage key — no migration.
- Reverses two documented decisions: carry-over as a conscious head action (HF10)
  and the alert bar carrying the reopen indicator (HF6). Both are called out in
  `design.md`.
- Tests: the affected component tests (`carry-over-banner.test.tsx` — removed,
  `alert-bar.test.tsx` + snapshot, `quick-add-button.test.tsx`,
  `review-acknowledge-bar.test.tsx`) and the carry-over service/integration tests
  update with the behavior.
- Not breaking for API consumers; no schema, no route change.
