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
7. Activating the collapse/expand-all control MUST apply to every section,
   including a section a user previously expanded or collapsed individually,
   on every press — not only the first press after the individual override
   was made. An individual section override MUST NOT survive a second (or
   later) Toggle-All command that happens to return the group to the same
   expanded/collapsed value the override was made under.

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

#### Scenario: Expand All wins after a full Toggle-All cycle

- **WHEN** a lead individually collapses one section while all sections are
  expanded (`groupExpanded=true`), then presses the trailing control twice —
  once to collapse all, once to expand all again (`groupExpanded` goes
  `true → false → true`)
- **THEN** the individually-collapsed section is expanded after the second
  press, honoring "Expand All"
- **AND** this holds regardless of how many Toggle-All cycles occur before or
  after the individual override

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
48 rem. Their accessible names and navigation behavior MUST remain unchanged,
and the arrows MUST NOT be clipped by the toolbar's responsive rows or sticky
surface.

#### Scenario: a Lead navigates periods on a phone or tablet

- **WHEN** period navigation is visible below 48 rem
- **THEN** both navigation arrows measure at least 44 by 44 CSS pixels
- **AND** each arrow is focusable, visible on focus, and operable by keyboard
  and pointer input

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

### Requirement: The lead toolbar preserves compact desktop grouping

The lead report context toolbar MUST keep its period controls compact at desktop widths. The period navigator MUST consume only the width required by its controls; it MUST NOT grow across the remaining row and push the archive filter into an isolated center position. Full-row growth is allowed only when required for compact responsive reflow.

#### Scenario: archive filter is visible on desktop

- **WHEN** the lead toolbar renders period navigation and the archive filter on a wide viewport
- **THEN** the archive filter reads as part of the period cluster rather than as a centered standalone action

#### Scenario: period controls need a full compact row

- **WHEN** the viewport is too narrow for both context clusters
- **THEN** the period controls MAY take a full row while keeping the period selector usable and the archive filter adjacent
