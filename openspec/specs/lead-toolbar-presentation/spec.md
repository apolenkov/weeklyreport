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
   actions (Submit Section, Publish & Lock, Toggle All, reversal actions), period
   navigation, the segmented toggles, the Agent-review placeholder, and the
   slides Fullscreen control — MUST sit on one shared height token
   (`--toolbar-control-h`), so the toolbar reads as a single row of equal-height
   controls.
5. The lead Mine/Everyone visibility toggle MUST render icon-only (one-person /
   group) while keeping an accessible name (sr-only text and/or tooltip), so it
   stays compact and does not crowd the period navigator.

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
