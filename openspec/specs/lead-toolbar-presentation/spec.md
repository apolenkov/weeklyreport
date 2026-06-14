## Purpose

The lead report toolbar and slide hero present controls with consistent shape
and height, and never use an indicator that implies an action where none is
intended. Established during the 2026-06-13 live-walk session
(polish-lead-toolbar-and-risk-dialog).

## Requirements

### Requirement: Lead report controls present consistently and without misleading affordances

The lead report toolbar and slide hero MUST present their controls with
consistent shape and height, and MUST NOT use an indicator that implies an
action where none is intended.

1. Inert toolbar controls (e.g. the version "Coming soon" affordance) MUST be
   visually consistent in shape with their sibling icon controls (the
   round 32×32 toolbar buttons), not a mismatched rectangle.
2. The archived-periods toggle MUST present its state quietly — it MUST NOT
   surface a count badge that reads as a call-to-action ("N archives, press
   me"); the count is not an action prompt.
3. Status badges in the slide hero row MUST share one height/baseline with the
   other elements of that row, at every status and product count.

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
