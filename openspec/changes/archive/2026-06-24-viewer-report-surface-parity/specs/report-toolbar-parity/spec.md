## MODIFIED Requirements

### Requirement: Report surfaces share one toolbar container component

Report-context control bars MUST render through one shared component.
Every such bar (period navigation, archive toggle, draft utilities) on
the lead, head, and viewer report surfaces uses `ReportToolbar`
(`apps/web/src/components/report-shell/report-toolbar.tsx`) — not
through per-surface bespoke containers. This covers the lead form
(`apps/web/src/components/lead/lead-form.tsx`), the head review shell
(`apps/web/src/components/head/head-report-shell.tsx`), the new viewer
report shell (the read-only analogue of the head shell consumed by
`/reports/[reportId]`), and the shared report page
(`apps/web/src/components/weekly-report/weekly-report-page.tsx`)
consumed by `/head/report`, `/reports/[reportId]`, and the lead
preview. A page MUST NOT stack two period toolbars; when a shell
composes the toolbar, it passes the element through the page's
explicit `toolbar` slot, which replaces the inner context bar and
renders below the page header row.

#### Scenario: the head review page renders

- **WHEN** `/head/report/[reportId]` renders in form mode
- **THEN** exactly one period toolbar appears, using the shared
  `ReportToolbar` container
- **AND** it sits below the page header row, matching the lead
  arrangement

#### Scenario: a standalone consumer of the shared report page renders

- **WHEN** `/reports/[reportId]` renders for a viewer
- **THEN** its period-context bar uses the shared `ReportToolbar`
  container
- **AND** the viewer report shell composes that bar through the page's
  `toolbar` slot, never stacking a second one

## ADDED Requirements

### Requirement: The viewer report toolbar presents the head control set minus mutations

The viewer report toolbar MUST render the head control set minus every mutation
control. The viewer MUST get the product/lead scope toggle, the slides (present)
view-mode control, and the Export-PDF action; the viewer MUST NOT get Publish &
Lock, Reopen, or Move-to-archive. Switching the viewer between edit and slides
modes MUST NOT add, remove, or reposition any of the viewer's controls. The
`?mode=slides` deep link (and the `/present` redirect into it) MUST render the
report in slides mode for the viewer, not silently fall back to form mode.

This brings the viewer toolbar to "head minus mutation" so a viewer can present the
report, while the read-only and published-only guarantees stay intact. It does not
change the lead or head toolbars.

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
