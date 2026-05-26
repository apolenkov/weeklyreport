## Purpose

Define the information architecture invariant that separates "History"
(snapshots within the current report) from "Archive" (past closed
reports). Ensures leads are never confused about where to find version
snapshots vs. previous periods.

## Requirements

### Requirement: Archive and History Have Distinct Navigation Surfaces

The lead-facing UI MUST surface Archive and History through distinct
navigation entry points and MUST NOT collapse them into a single tab.
"History" denotes snapshots and edits within a single report; "Archive"
denotes past closed reports. The two MUST be reachable from clearly
distinct locations (e.g., History inside the report toolbar, Archive
in a separate sidebar entry or page).

#### Scenario: Lead opens the report and looks for previous snapshots

- **WHEN** a lead opens a current report and wants to review prior snapshots of the same report
- **THEN** the History entry point is visible within the report context (toolbar or report-scoped sidebar)
- **AND** the History view loads snapshots scoped to the currently-open report

#### Scenario: Lead wants to see past closed reports

- **WHEN** a lead wants to browse reports from previous periods
- **THEN** the Archive entry point is visible outside the current-report context (global nav or top-level page)
- **AND** the Archive view lists past reports, not snapshots of the current one

### Requirement: Each Entry Point Carries an Explanatory Tooltip or Label

The History and Archive navigation controls MUST each include an
explanatory tooltip (or aria-label) describing what the surface
contains. The text MUST make the distinction unambiguous without
requiring the user to click into either.

#### Scenario: User hovers over History

- **WHEN** the user hovers over (or focuses) the History control
- **THEN** a tooltip or aria-label reading approximately "Snapshots and edits within this report" is announced

#### Scenario: User hovers over Archive

- **WHEN** the user hovers over (or focuses) the Archive control
- **THEN** a tooltip or aria-label reading approximately "Past weeks and closed reports" is announced
