# Proposal

## Why

Browser audit chunk 5b identified two layout/style regressions in Lead and Report UI components (TASK-503.86, C5311 and C3013):

1. **C5311**: In `apps/web/src/shared/ui/report-shell/report-toolbar.tsx`, `useStickyScrollOffset` sets `--sticky-toolbar-offset` on the root document element. However, toolbar stickiness is enabled by CSS only at `md:` (`md:sticky md:top-0`). At viewports narrower than `768px` (such as 375px mobile), the toolbar is static in the flow, but `--sticky-toolbar-offset` is still populated with the element's height, leaving an unwanted scroll padding / offset on the document. Checking viewport match via `window.matchMedia("(min-width: 48rem)")` (standard Tailwind `md` breakpoint) ensures `--sticky-toolbar-offset` is only set when the toolbar is actually sticky.
2. **C3013**: In `apps/web/src/features/report-sections/ui/status-overview-layout.ts` and `apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx`, timeline cells have `md:border-l md:border-[var(--color-border-subtle)]`. At intermediate viewports (`md` to wide `< 80rem`), the summary card sits above the timeline grid. The first column ("Previously planned") had a left border while the row container has no outer border, producing an asymmetric left border on the timeline grid. Removing `md:border-l` from the first column (`first:md:border-l-0`) or omitting it on the first column aligns with the container.

## What Changes

- In `apps/web/src/shared/ui/report-shell/report-toolbar.tsx`, update `useStickyScrollOffset` to check `window.matchMedia("(min-width: 48rem)").matches` (listening to change events or during resize), or clear `--sticky-toolbar-offset` when below `md`.
- In `apps/web/src/features/report-sections/ui/status-overview-layout.ts` and `apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx`, ensure the first column of the timeline grid does not have a left border on `md`.

## Capabilities

### Modified Capabilities

- `report-toolbar-layout`: Sticky toolbar offset CSS variable is only set on viewports where the toolbar actually sticks (`min-width: 48rem`).
- `lead-status-overview`: The timeline grid at `md` viewports does not render an extraneous left border on the first column.

## Impact

- `apps/web/src/shared/ui/report-shell/report-toolbar.tsx`
- `apps/web/src/features/report-sections/ui/status-overview-layout.ts`
- `apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx`
- Accompanying unit tests.
