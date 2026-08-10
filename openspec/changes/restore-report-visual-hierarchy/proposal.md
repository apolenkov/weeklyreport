## Why

The lead report lost visual hierarchy after the exemplary refactor: the archive filter drifts away from period navigation on wide screens, and single-author slides repeat the already-known owner initials on every record series. The current UI screenshots, the R56 runtime evidence, and the regression introduced in `apps/web/src/features/period/ui/period-navigator.tsx` at `95203545` justify restoring the compact baseline before the exhaustive retest is accepted.

## What Changes

- Keep period navigation and its archive filter as one compact left toolbar cluster at desktop widths while retaining responsive wrapping.
- Treat author marks as context: suppress the selected deck owner's repeated initials in the single-author Mine view, but show stable author marks for all contributors in Everyone and multi-author views.
- Add repeatable screenshot review coverage for lead, head, admin, and viewer surfaces at desktop and compact viewports, including edit/slides and Mine/Everyone states.
- Make report and slide loading skeletons follow the same page, toolbar, and content hierarchy as the loaded surfaces so hydration does not cause avoidable layout jumps.
- Keep intrinsically wide slide canvases and admin tables inside their local horizontal scroll surfaces at compact widths instead of expanding the document.
- Compare clean screenshots against pre-refactor evidence before accepting visual fixes; browser inspector overlays are not product defects.

### Non-goals

- Redesigning the report information architecture, colors, typography, or slide content model.
- Changing report data, permissions, persisted visibility, exports, or runtime-sweep case semantics.
- Hiding contributor identity in genuinely multi-author views.

## Capabilities

### New Capabilities

- `loading-layout-stability`: Loading placeholders preserve the visible hierarchy and approximate geometry of the loaded report or slide surface.
- `compact-overflow-containment`: Intrinsically wide report and admin content remains reachable through local scrolling without widening the document.

### Modified Capabilities

- `report-toolbar-layout`: Period navigation and archive visibility form one stable context cluster, with screenshot evidence across roles and widths.
- `lead-toolbar-presentation`: The lead context toolbar preserves compact desktop grouping without losing narrow-width reachability.
- `lead-slide-by-product-grid`: Author marks distinguish contributors in multi-author scope and do not repeat the already-selected owner in single-author scope.

## Impact

- Frontend layout and slide-model files under `apps/web/src/features/admin`, `apps/web/src/features/period`, `apps/web/src/features/report-pages`, and `apps/web/src/features/slides`.
- Focused Vitest coverage plus role/viewport screenshot artifacts under the external `customreport-archive`, not `docs/`.
- No API, database, authorization, or production migration impact.
