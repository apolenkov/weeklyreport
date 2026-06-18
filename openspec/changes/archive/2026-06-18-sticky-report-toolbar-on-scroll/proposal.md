# Stick the lead report context toolbar to the top on scroll

## Why

On long lead reports the bordered context toolbar (period nav · show-archived ·
Mine|Everyone · Edit|Slides · collapse/fullscreen) scrolls out of view, so the
lead loses quick access to period navigation and the view-mode controls while
reading down the document.

Live-demo feedback: «можно сделать эту штуку закрепленной, чтобы при скролле её
всегда видеть» — make the context toolbar stay visible on scroll so it is always
reachable.

The whole app page scrolls in the viewport (the `(app)` layout does not create
an inner scroll container, the document body is `min-h-svh`, and the NavBar is
normal-flow, not sticky). A `position: sticky; top: 0` on the context toolbar is
therefore the right mechanism: it pins to the top of the viewport once the
NavBar and the document-action header scroll past.

## What Changes

- The lead report **context toolbar** (the single bordered `ReportToolbar` row)
  sticks to the top of the viewport on scroll and stays reachable on long
  reports.
- When stuck, it sits above the report content (raised stacking context) and
  carries a subtle elevation cue (shadow and/or stronger border) so it reads as
  a pinned bar rather than overlapping the content ambiguously.
- The toolbar background becomes opaque when stuck so scrolling content does not
  bleed through the translucent frame.
- The document-action header line (title, status, Save/Submit/Publish, the
  Coming-soon stubs) stays in normal flow and scrolls away above the pinned bar;
  it is **not** part of the sticky region, so the two-row document-vs-context
  layout is preserved.
- The sticky behavior is opt-in on `ReportToolbar` so only the lead context bar
  adopts it; other `ReportToolbar` usages keep their current non-sticky flow.

## Out of scope

- Making the NavBar or the document-action header sticky.
- Any change to which controls live in the context bar or the document-action
  group (that ordering is owned by `report-toolbar-layout`).
- Slides-mode hero/deck layout, fullscreen behavior, or non-lead report shells.
- A scroll-direction "hide on scroll down / show on scroll up" auto-hide
  pattern; the bar simply pins.

## Impact

- Affected specs: `lead-toolbar-presentation` (ADDED — a new sticky-toolbar
  requirement alongside the existing presentation requirement).
- Affected code:
  - `apps/web/src/components/report-shell/report-toolbar.tsx` — `ReportToolbar`
    gains an opt-in sticky variant (sticky positioning, raised z-index, opaque
    stuck background, elevation cue).
  - `apps/web/src/components/lead/lead-form.tsx` — the lead `ReportToolbar`
    usage (~line 1219) enables the sticky variant.
  - `apps/web/src/components/report-shell/report-toolbar.test.tsx` — assert the
    sticky variant renders the sticky classes and the default stays non-sticky.
