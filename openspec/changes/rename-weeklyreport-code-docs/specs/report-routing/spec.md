## MODIFIED Requirements

### Requirement: Report Page Title and Breadcrumb Reflect the Report

The page title (`<title>` element) and the in-app breadcrumb MUST
include identifying metadata for the currently-loaded report (e.g.,
"Week of YYYY-MM-DD — WeeklyReport"). The metadata MUST update when
the route's identifier changes.

#### Scenario: Lead navigates from report A to report B

- **WHEN** a lead is on report A and clicks a navigation link to report B
- **THEN** the browser tab title updates to reflect report B's period
- **AND** the breadcrumb reflects report B's period

#### Scenario: Lead bookmarks a report URL

- **WHEN** a lead bookmarks the URL of a specific report
- **THEN** opening the bookmark loads that exact report
- **AND** the page title and breadcrumb match what was originally shown
