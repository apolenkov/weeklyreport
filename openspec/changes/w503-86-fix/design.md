# Design

## C5311: Viewport-aware Sticky Toolbar Offset

Tailwind v4's `md` breakpoint matches `@media (width >= 48rem)`. In `app.css`:

```css
@media (width >= 48rem) {
  html {
    scroll-padding-top: var(--sticky-toolbar-offset, 5rem);
  }
}
```

And `REPORT_TOOLBAR_FRAME_STICKY_CLASS` has `md:sticky md:top-0 md:z-20 md:shadow-md`.
At screen widths below `48rem` (768px), the toolbar is in normal static flow.
`useStickyScrollOffset(active)` in `report-toolbar.tsx` attaches a `ResizeObserver` to update `--sticky-toolbar-offset`.
To ensure `--sticky-toolbar-offset` reflects actual sticky state across resizes and breakpoints:

1. When checking/updating offset, evaluate whether the sticky media query matches:
   `const isSticky = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 48rem)").matches : true;`
2. If `!isSticky`, remove property `--sticky-toolbar-offset`.
3. If `isSticky`, set `--sticky-toolbar-offset` to `${el.offsetHeight + SCROLL_OFFSET_GAP_PX}px`.
4. Listen to media query changes (or window resize events, in addition to element ResizeObserver) to update on viewport changes.

## C3013: Remove Leading Left Border on First Timeline Cell

In `apps/web/src/features/report-sections/ui/status-overview-layout.ts`:
`TIMELINE_CELL` is used by `DesktopPeriodHeader` and `EmptyLane`.
In `LineageRow` (`status-overview-lineage-row.tsx:156`):
Each cell has `className="group/lane min-w-0 px-3 py-1 block border-t border-[var(--color-border-subtle)] first:border-t-0 md:px-4 md:py-3 md:min-h-24 md:flex-col md:border-t-0 md:border-l md:border-[var(--color-border-subtle)] md:flex"`.
Notice `first:border-t-0` for mobile. On `md:`, `md:border-l` is applied to all 3 columns.
By adding `first:md:border-l-0` (or `first:border-l-0 md:border-l md:first:border-l-0`) to `TIMELINE_CELL` and the `LineageRow` column wrapper, the first column ("Previously planned") will have no left border, while columns 2 and 3 ("Current week", "Next week") keep their left separator borders.
