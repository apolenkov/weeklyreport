## MODIFIED Requirements

### Requirement: The Lead context toolbar has an explicit responsive flow

The Lead report context toolbar (the bordered `ReportToolbar` on the Lead
report route) MUST remain usable at every supported width without overlapping
the document-action header or the report content.

1. Below 48 rem the toolbar MUST stay in normal document flow and use at most
   two explicit content rows. It MUST NOT create a clipped control, a
   spacer-only row, or a horizontal scroller.
2. At 48 rem and above the toolbar MUST pin to the top of the viewport when the
   page scrolls (`position: sticky` with a top offset of `0`), so period
   navigation and the view-mode controls stay visible on long reports.
3. When pinned, the toolbar MUST sit above the report content in stacking order
   so scrolling content passes behind it, never over it.
4. When pinned, the toolbar background MUST be opaque so scrolling content does
   not bleed through, and it MUST carry a subtle elevation cue.
5. The document-action header line (title, status, Save / Submit / Publish, and
   Coming-soon stubs) MUST stay in normal document flow and MUST NOT be part of
   the sticky region.
6. Sticky behavior MUST remain opt-in on `ReportToolbar`; non-Lead report-shell
   usages that do not opt in MUST keep normal document flow.
7. A visible fixed completion rail MUST receive bottom clearance from exactly
   one named, conditional form-owned source. Route containers MUST NOT add an
   always-on competing clearance.
8. Responsive positioning MUST NOT change the shared
   `--toolbar-control-h` control height or the logical period and utility
   clusters. Every visible control MUST remain reachable, visible on focus, and
   operable without clipping.

#### Scenario: the toolbar stays compact and in flow on a phone

- **WHEN** the Lead report renders below 48 rem
- **THEN** the context toolbar remains in normal document flow
- **AND** its controls occupy no more than two explicit rows
- **AND** every visible control remains reachable without clipping or a
  horizontal scroller

#### Scenario: the toolbar becomes sticky from tablet width

- **WHEN** the Lead report renders at or above 48 rem and the page scrolls
- **THEN** the context toolbar pins using the existing sticky surface
- **AND** the document-action header remains outside the sticky region
- **AND** any visible fixed completion rail receives bottom clearance from
  exactly one named, conditional form-owned source
- **AND** route containers do not add an always-on competing clearance

#### Scenario: the pinned toolbar does not overlap content

- **WHEN** the context toolbar is pinned and report content scrolls beneath it
- **THEN** the content passes behind the toolbar with an opaque background and
  raised stacking order, so no content shows through or paints over it

#### Scenario: the document-action header is not pinned

- **WHEN** the Lead document-action header reaches the top during a scroll
- **THEN** that header scrolls away while only the context toolbar stays pinned
- **AND** the two surfaces do not overlap

#### Scenario: a non-opt-in toolbar stays in flow

- **WHEN** a `ReportToolbar` is rendered without the sticky variant enabled
- **THEN** it renders in normal document flow with no sticky positioning

### Requirement: Lead period navigation arrows remain touch-safe

The previous/next period navigation arrows in the Lead context toolbar MUST
remain keyboard reachable and MUST render at least 44 by 44 CSS pixels below
48 rem. Their accessible names and navigation
behavior MUST remain unchanged, and the arrows MUST NOT be clipped by the
toolbar's responsive rows or sticky surface.

#### Scenario: a Lead navigates periods on a phone or tablet

- **WHEN** period navigation is visible below 48 rem
- **THEN** both navigation arrows measure at least 44 by 44 CSS pixels
- **AND** each arrow is focusable, visible on focus, and operable by keyboard
  and pointer input
