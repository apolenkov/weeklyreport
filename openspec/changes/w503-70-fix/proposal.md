# Proposal

## Why

Screen reader and accessibility tree audits of the weekly report and slides interfaces identified two accessibility defects:

1. **C5026**: In `apps/web/src/features/report-sections/ui/portfolio/portfolio-overview-cards.tsx`, the status glyph inside `LeadOverviewCard` and `ProductOverviewCard` is rendered without `aria-hidden="true"`, causing screen readers to announce the decorative glyph (e.g., "✕", "!", "✓", "–") redundantly alongside the adjacent readable status label / "No updates" text in the button's accessible name.
2. **C5197**: In `apps/web/src/features/slides/ui/slide-article-rows.tsx`, `SlideCell` renders an empty cell placeholder using a `<span aria-label={`No ${label}`}>...</span>` without a semantic role. Generic `span` elements with `aria-label` are ignored by assistive technologies according to WAI-ARIA and accessibility tree implementations in Chrome/Safari, leaving screen reader users without the empty cell announcement.

## What Changes

- Mark status glyph badges in `portfolio-overview-cards.tsx` (`LeadOverviewCard` and `ProductOverviewCard`) with `aria-hidden="true"` so that the accessible button name relies cleanly on the textual name, status label, and count summary without decorative glyph duplication.
- Give the empty cell announcement container in `slide-article-rows.tsx` (`SlideCell`) `role="img"` with `aria-label={`No ${label}`}` so assistive technologies expose the label in the accessibility tree as intended.
- Colocate focused behavioral tests ensuring the accessibility tree and DOM attributes reflect `aria-hidden="true"` on the status badges and `role="img"` with accessible name on empty slide cells.

## Capabilities

### Modified Capabilities

- `portfolio-content-presence`: Portfolio overview cards hide decorative status glyphs from assistive technology while preserving readable status labels and counts.
- `lead-slide-by-product-grid`: Empty slide cells expose an accessible empty-cell announcement with `role="img"` and `aria-label`.

## Impact

- `apps/web/src/features/report-sections/ui/portfolio/portfolio-overview-cards.tsx`
- `apps/web/src/features/slides/ui/slide-article-rows.tsx`
- Associated tests in `portfolio-overview-table.test.tsx` and `slide-article-rows.test.tsx` (or colocated test files).

## Non-goals

- Altering visual styling, color tokens, layout, or interactions of portfolio cards or slide cells.
- Changing slide row disclosure or editing behavior.
