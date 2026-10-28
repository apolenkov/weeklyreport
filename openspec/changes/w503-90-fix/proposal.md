# Proposal

## Why

In `apps/web/src/features/report-pages/ui/product/accordion-header.tsx`, the interactive `<button>` element renders inner `<div>` elements (`HeaderIdentity` container, avatar circle, and title/leads containers). According to the HTML specification, `<button>` elements must contain only phrasing content. Rendering block-level `<div>` descendants inside interactive `<button>` controls creates invalid DOM nesting, causes browser hydration issues, and fails accessibility / conformance checks (C5025, TASK-503.90).

## What Changes

- In `accordion-header.tsx`, replace all `<div>` elements inside the `<button>` toggle with phrasing elements (`<span>`) using the same CSS classes, layouts, and styles.
- Preserve all interactive, visual, responsive, and accessibility behaviors (accordion toggle, avatar, status badge, title, leads, and rotating chevron).
- Update `lead-product-accordion-identity` spec to require that `AccordionHeader` toggle controls contain only valid phrasing content without `div` descendants.
- Add test assertions checking that `AccordionHeader` and product accordion button toggles have zero `div` descendants.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-product-accordion-identity`: product accordion header button disclosure controls use valid phrasing descendants.

## Impact

- `apps/web/src/features/report-pages/ui/product/accordion-header.tsx`
- `apps/web/src/features/report-pages/ui/product/accordion-header.test.tsx` (new/updated tests)
- No API, database schema, or persistence changes.
