# Design: Valid Phrasing Content in Accordion Header

## Context

The HTML specification specifies that a `<button>` element's content model is phrasing content, but there must be no interactive content descendant. `<div>` is flow content, not phrasing content. Placing `<div>` elements inside a `<button>` can lead to browser auto-correction, invalid DOM hierarchies during SSR/hydration, and DOM tree traversal inconsistencies.

In `apps/web/src/features/report-pages/ui/product/accordion-header.tsx`, `AccordionHeader` renders:

```tsx
<button ...>
  <HeaderIdentity ... />
  <RotatingChevron ... />
</button>
```

Where `HeaderIdentity` currently renders:

- Line 30: `<div className="flex min-w-0 flex-1 items-center gap-3 pr-3">`
- Line 31: `<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold" ...>`
- Line 37: `<div className="flex min-w-0 flex-col gap-0.5">`
- Line 38: `<div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2.5">`

All these elements use flexbox display utility classes (`flex`), so substituting `<span>` for `<div>` produces identical CSS rendering and layout while conforming strictly to the phrasing content model for `<button>`.

## Technical Decisions

1. **Replace `div` with `span` in `HeaderIdentity`**:
   Replace the 4 `<div>` tags with `<span>` tags. Because all 4 wrappers use `flex` (`display: flex`), their computed layout and CSS flex container behaviors are identical in modern browsers.
2. **Preserve classes, props, and styling**:
   Keep all styling, inline styles, accessibility attributes (`aria-hidden="true"`, `data-product-accordion-toggle`), and event handlers unchanged.
3. **Verification**:
   Create a dedicated unit test `accordion-header.test.tsx` verifying:
   - Button element exists and has role `button`.
   - The button contains zero `<div>` elements (`button.querySelectorAll('div').length === 0`).
   - All content (product name, initials, status, leads) renders as expected in accessible tree.
   - Click/toggle behavior functions as expected.
