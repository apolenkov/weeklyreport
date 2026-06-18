## ADDED Requirements

### Requirement: The lead context toolbar stays reachable on scroll

The lead report context toolbar (the single bordered `ReportToolbar` row) MUST stick to the top of the viewport on scroll so it stays reachable on long reports, without overlapping the document-action header or breaking the two-row document-vs-context layout.

1. The bordered context toolbar MUST pin to the top of the viewport once the
   page scrolls (`position: sticky` with a top offset of `0`), so period
   navigation and the view-mode controls stay visible while the lead reads down
   a long report.
2. When pinned, the toolbar MUST sit above the report content in stacking order
   (a raised z-index) so scrolling content passes behind it, never over it.
3. When pinned, the toolbar background MUST be opaque (not the resting
   translucent frame) so scrolling content does not bleed through, and it MUST
   carry a subtle elevation cue (a shadow and/or a stronger border edge) so it
   reads as a pinned bar.
4. The document-action header line (title, status, Save / Submit / Publish, the
   Coming-soon stubs) MUST stay in normal document flow and scroll away above
   the pinned toolbar; it MUST NOT be part of the sticky region, so the pinned
   bar never overlaps it.
5. The sticky behavior MUST be opt-in on `ReportToolbar`; usages that do not opt
   in (non-lead report shells) MUST keep their current non-sticky flow.
6. Pinning MUST NOT change the toolbar's single-row, two-cluster content
   (period/where-you-are on the left, view controls on the right) nor the
   shared `--toolbar-control-h` control height; it changes only the toolbar's
   positioning and stuck-state surface.

#### Scenario: the toolbar pins on scroll

- **WHEN** a lead scrolls down a long report past the document-action header
- **THEN** the bordered context toolbar stays pinned at the top of the viewport
- **AND** the period navigation and view-mode controls remain visible and
  clickable

#### Scenario: the pinned toolbar does not overlap content

- **WHEN** the context toolbar is pinned and report content scrolls beneath it
- **THEN** the content passes behind the toolbar (the toolbar's raised z-index
  keeps it on top) with an opaque background, so no content shows through

#### Scenario: the document-action header is not pinned

- **WHEN** a lead scrolls down so the title/status/Save-Submit header reaches the
  top
- **THEN** that header scrolls away out of view while only the context toolbar
  stays pinned, so the two never overlap

#### Scenario: a non-opt-in toolbar stays in flow

- **WHEN** a `ReportToolbar` is rendered without the sticky variant enabled
- **THEN** it renders in normal document flow with no sticky positioning
