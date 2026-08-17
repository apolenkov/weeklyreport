## Why

Fresh owner walkthroughs on the seeded desktop stand exposed presentation defects: route navigation scrolls the persistent header out of view, the empty History panel is visually detached from its summary rail, report document actions wrap to the left, slide controls consume avoidable rows, and Dashboard row actions shift when Details is toggled. The screenshots and source/runtime maps from 2026-08-17 justify one bounded desktop composition pass before the showcase is accepted.

## What Changes

- Keep the persistent desktop navigation visible at scroll position zero when switching History, Dashboard, and Status.
- Give application pages a restrained decorative paper background using existing tokens and CSS-only, non-semantic shapes.
- Align the History empty panel with the full summary rail and reduce unused space without changing history data.
- Keep Head document actions right-aligned on desktop and preserve the disabled `Nothing to publish` primary action.
- Move the working Document/Presentation density controls into the report context toolbar so Head and hosted Lead slide decks no longer create a separate control row; standalone Lead decks may retain their local density toolbar.
- Add one visible inert `Slide templates` Coming-Soon affordance and a separate deferred backlog record for future template selection.
- Reserve compact Dashboard action tracks and matching skeleton geometry so disclosure labels and loading transitions do not move adjacent controls.
- Produce a fresh source-bound desktop screenshot matrix and independent visual review.

### Non-goals

- Mobile or compact-layout redesign.
- New colors, image assets, animation, report data, permissions, exports, or slide-template implementation.
- Changing the working Document/Presentation density semantics.

## Capabilities

### New Capabilities

- `desktop-surface-composition`: Desktop route scroll position, decorative page background, History empty-state composition, and source-bound visual acceptance.
- `dashboard-interaction-stability`: Dashboard queue actions and skeleton rows retain stable desktop geometry across disclosure and loading states.

### Modified Capabilities

- `report-toolbar-layout`: Head header and context controls keep a stable two-column action hierarchy and one compact context row.
- `head-slide-density`: The existing density control moves into Head and hosted Lead report context chrome without changing deck behavior.
- `deferred-feature-pattern`: Slide-template selection has one canonical visible inert Coming-Soon trace until activation.

## Impact

- Frontend-only changes under `apps/web/src/app/(app)`, `apps/web/src/features/period`, `apps/web/src/features/report-pages`, `apps/web/src/features/slides`, and shared report/navigation UI.
- OpenSpec change artifacts plus one record under `openspec/deferred/`.
- Focused Vitest, desktop Playwright walkthrough, accessibility checks, and screenshots in `customreport-archive`; no API, database, migration, dependency, or production impact.
