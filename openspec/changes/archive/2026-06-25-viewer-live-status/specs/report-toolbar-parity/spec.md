## MODIFIED Requirements

### Requirement: The viewer report toolbar presents the head control set minus mutations

The viewer report toolbar MUST render the head control set minus every mutation
control. The viewer MUST get the product/lead scope toggle, the slides (present)
view-mode control, and the Export-PDF action; the viewer MUST NOT get Publish &
Lock, Reopen, or Move-to-archive. Switching the viewer between edit and slides
modes MUST NOT add, remove, or reposition any of the viewer's controls. The
`?mode=slides` deep link (and the `/present` redirect into it) MUST render the
report in slides mode for the viewer, not silently fall back to form mode.

This brings the viewer toolbar to "head minus mutation" so a viewer can present the
report, while the read-only guarantee stays intact. The **published-only guarantee
is removed** by `viewer-live-status` (the viewer now reads the current period live);
the toolbar's control set and read-only stance are unchanged. It does not change the
lead or head toolbars.

#### Scenario: Viewer sees the presenting controls

- **WHEN** `/reports/[reportId]` renders for a viewer
- **THEN** the toolbar shows the product/lead scope toggle, the slides view-mode
  control, and the Export-PDF action
- **AND** all of them use the shared `ReportToolbar` container

#### Scenario: Viewer never sees mutation controls

- **WHEN** the viewer report toolbar renders in either edit or slides mode
- **THEN** Publish & Lock, Reopen, and Move-to-archive are absent
- **AND** no other control mutates report or period state

#### Scenario: Viewer slides deep link renders slides

- **GIVEN** a viewer
- **WHEN** the viewer opens `/reports/[reportId]?mode=slides` (or `/present`, which
  redirects there)
- **THEN** the report renders in slides mode, not form mode

#### Scenario: Viewer control set is stable across modes

- **GIVEN** a viewer on `/reports/[reportId]`
- **WHEN** the viewer toggles the view-mode control between edit and slides
- **THEN** the scope toggle, the view-mode control, and Export-PDF remain present
  in the same positions
