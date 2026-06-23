## Purpose

The lead report toolbar and slide hero present controls with consistent shape
and height, and never use an indicator that implies an action where none is
intended. Established during the 2026-06-13 live-walk session
(polish-lead-toolbar-and-risk-dialog).

## Requirements

### Requirement: Lead report controls present consistently and without misleading affordances

The lead report toolbar and slide hero MUST present their controls with consistent shape and one shared height, and MUST NOT use an indicator that implies an action where none is intended.

1. Inert toolbar controls (e.g. the version "Coming soon" affordance) MUST be
   visually consistent in shape with their sibling icon controls (the round
   32×32 toolbar buttons), not a mismatched rectangle.
2. The archived-periods toggle MUST present its state quietly — it MUST NOT
   surface a count badge that reads as a call-to-action ("N archives, press
   me"); the count is not an action prompt.
3. Status badges in the slide hero row MUST share one height/baseline with the
   other elements of that row, at every status and product count.
4. Every report-toolbar control — the document-action icon buttons and pill
   actions (Submit Section, Publish & Lock, reversal actions), period
   navigation, the segmented toggles, the Agent-review placeholder, and the
   mode-adaptive collapse/fullscreen control — MUST sit on one shared height
   token (`--toolbar-control-h`), so the toolbar reads as a single row of
   equal-height controls.
5. The lead Mine/Everyone visibility toggle MUST render icon-only (one-person /
   group) while keeping an accessible name (sr-only text and/or tooltip), so it
   stays compact and does not crowd the period navigator.
6. The lead context bar's trailing utility control MUST be a single
   mode-adaptive icon-only control occupying one fixed-width slot: in edit mode
   it collapses/expands all report sections; in slides mode it toggles
   fullscreen. It MUST keep the same position and width across modes so switching
   edit↔slides does not shift the row, and each variant MUST keep an accessible
   name (sr-only text and/or tooltip). There MUST NOT be a separate slides-only
   fullscreen control or an inert edit-only "Toggle All" rendered in slides where
   it has nothing to expand; the single mode-adaptive control replaces both.
   In edit mode its accessible name and tooltip MUST reflect the current state —
   "Collapse all sections" when sections are expanded, "Expand all sections" when
   collapsed. The slot MUST be reserved (rendered, disabled when there is nothing
   to collapse — not removed from the DOM) so adding or removing sections within a
   session never makes the control appear/disappear and shift the row.

#### Scenario: the version coming-soon control sits among icon buttons

- **WHEN** the lead report toolbar renders the inert "Coming soon" version
  control next to the round 32×32 icon buttons
- **THEN** it is rendered with a consistent rounded shape, visually part of the
  same control set

#### Scenario: archived periods are present

- **WHEN** a lead report has archived periods and the archive toggle is shown
- **THEN** the toggle indicates the state without a count badge that implies a
  pending action

#### Scenario: the slide hero shows a status badge

- **WHEN** the lead slide hero renders a status badge ("Blockers" / at-risk /
  on-track) in its header row
- **THEN** the badge height matches the sibling row elements (no taller box)

#### Scenario: the toolbar controls share one height

- **WHEN** the lead report toolbar renders its controls (header document actions
  and the context bar)
- **THEN** every control resolves to the same `--toolbar-control-h` height, so no
  control is visibly taller or shorter than its neighbours

#### Scenario: the trailing control adapts by mode without shifting the row

- **WHEN** a lead switches the same report between edit and slides mode
- **THEN** the trailing utility control stays in the same slot at the same width,
  showing a collapse-all icon in edit and a fullscreen icon in slides
- **AND** activating it in edit collapses/expands all sections, while in slides
  it toggles fullscreen
- **AND** no separate slides-only fullscreen button or inert "Toggle All" renders
  alongside it

#### Scenario: the edit-mode label reflects collapse state

- **WHEN** a lead in edit mode has all sections expanded, then collapses them via
  the control
- **THEN** the control's accessible name/tooltip reads "Collapse all sections"
  while expanded and "Expand all sections" once collapsed

#### Scenario: adding a section in-session does not shift the control

- **WHEN** a lead with an empty edit report (nothing to collapse) adds a section
- **THEN** the trailing control stayed in its reserved slot the whole time
  (disabled while empty, then enabled), so its position never shifted

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

### Requirement: The lead commit control is labeled "Submit"

The lead's forward commit control on the report header MUST be labeled
"Submit" (not "Submit Section"). On the lead report page a lead only ever
sees their own section, so "Section" adds no information; the shorter
label reads cleanly against the adjacent "Save" control. This label is
the normative source and supersedes incidental "Submit Section" naming in
other toolbar specs, which name the same control descriptively. The
submit confirmation dialog MAY keep fuller explanatory wording, but its
primary action MUST also read "Submit".

#### Scenario: Lead sees the commit control

- **WHEN** a lead views an editable, not-yet-submitted report
- **THEN** the forward commit button reads "Submit"
- **AND** it is not labeled "Submit Section"

#### Scenario: Submit confirmation primary action

- **WHEN** the lead opens the submit confirmation dialog
- **THEN** the dialog's primary action button reads "Submit"
