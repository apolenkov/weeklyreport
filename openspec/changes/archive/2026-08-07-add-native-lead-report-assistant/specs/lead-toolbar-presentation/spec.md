## MODIFIED Requirements

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
   navigation, the segmented toggles, the Agent-review placeholder, the active
   Lead Chat control, and the mode-adaptive collapse/fullscreen control — MUST
   sit on one shared height token (`--toolbar-control-h`), so the toolbar reads
   as a single row of equal-height controls.
5. The Lead-only Chat control MUST render immediately beside Agent review in the
   right-aligned context-control cluster, MUST use the existing active toolbar
   control language rather than Coming-Soon chrome, and MUST open a report-native
   assistant surface without shifting the remaining controls. It MUST NOT render
   as active for head, admin, viewer, preview, print, or unrelated surfaces.
6. The lead Mine/Everyone visibility toggle MUST render icon-only (one-person /
   group) while keeping an accessible name (sr-only text and/or tooltip), so it
   stays compact and does not crowd the period navigator.
7. The lead context bar's trailing utility control MUST be a single
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

- **WHEN** the lead report has archived periods and the archive toggle is shown
- **THEN** the toggle indicates the state without a count badge that implies a
  pending action

#### Scenario: the slide hero shows a status badge

- **WHEN** the lead slide hero shows a status badge ("Blockers" / at-risk /
  on-track) in its header row
- **THEN** the badge height matches the sibling row elements (no taller box)

#### Scenario: the toolbar controls share one height

- **WHEN** the lead report toolbar renders its controls (header document actions
  and the context bar)
- **THEN** every control resolves to the same `--toolbar-control-h` height, so no
  control is visibly taller or shorter than its neighbours

#### Scenario: Lead Chat is native and adjacent to Agent review

- **WHEN** the Lead context toolbar renders in edit or slides mode
- **THEN** an active Chat control appears immediately beside Agent review with an
  accessible English name and established active-control styling
- **AND** activating it opens the assistant without reordering or shifting the
  visibility, view-mode, and collapse/fullscreen controls

#### Scenario: non-Lead report surfaces preserve existing controls

- **WHEN** a head, admin, viewer, preview, or print surface renders
- **THEN** it does not gain the active Lead Chat control
- **AND** its existing Agent-review placeholder behavior remains unchanged

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
