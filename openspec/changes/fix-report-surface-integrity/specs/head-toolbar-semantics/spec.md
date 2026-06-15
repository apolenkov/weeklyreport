## REMOVED Requirements

### Requirement: Header utility actions carry visible text labels

**Reason**: The standalone `Present` link and the browser `Print` link
are removed from report surfaces. Presentation is now Slides mode
(`?mode=slides`) and `/present` 308-redirects to it; the only export is
the labeled server Export-PDF action. With no Present/Print header links
left, the requirement that they carry visible text labels no longer
applies.

**Migration**: Presentation is reached via the `ViewModeToggle` Slides
mode; the PDF artifact is reached via the single labeled Export-PDF
action in the `ReportToolbar` trailing group (see `report-toolbar-parity`).

## ADDED Requirements

### Requirement: The head report header uses the lean lead shape

The head report header MUST adopt the lean lead shape
(`apps/web/src/components/head/head-report-shell.tsx`): the
report-status pill on the left of
the first row; the segmented toggles and real actions on the right; and a
single `ReportToolbar` period row below. The header MUST NOT stack two
period toolbars. The publish precondition hint MUST sit on the
report-status row, not on the action row. `Present` and browser `Print`
MUST NOT be required header actions. `ScopeToggle`
(`apps/web/src/components/report-shell/scope-toggle.tsx`) MUST share the
same segmented-toggle visual family as `ViewModeToggle`
(`apps/web/src/components/report-shell/view-mode-toggle.tsx`).

#### Scenario: the head report header renders in the lean shape

- **WHEN** `/head/report/[reportId]` renders in form mode
- **THEN** the report-status pill sits on the left of the first row
- **AND** the toggles and actions sit on the right
- **AND** exactly one `ReportToolbar` period row renders below, with no
  second stacked period toolbar

#### Scenario: the scope and view-mode toggles share one family

- **WHEN** the head report header renders the `ScopeToggle` and the
  `ViewModeToggle` together
- **THEN** both render in the same segmented-toggle visual family

#### Scenario: Present and Print are not header actions

- **WHEN** the head report header renders its actions
- **THEN** no `Present` action and no browser-`Print` action is required
  in the header
