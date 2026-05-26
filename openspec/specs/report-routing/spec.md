# report-routing Specification

## Purpose

Define the URL shape invariant for lead and head report views. Ensures that
every report page carries a stable, bookmarkable path-segment identifier so
that links, deep-links, and browser history resolve to the correct report.

Consumer surfaces: Next.js routes
`apps/web/src/app/(app)/lead/report/[reportId]/page.tsx` and
`apps/web/src/app/(app)/head/report/[reportId]/page.tsx`.

## Requirements

### Requirement: Report URLs Encode the Report Identifier as a Path Segment

Lead and head report routes MUST encode a stable UUID identifier in the URL
as a path segment: `/lead/report/[reportId]` and `/head/report/[reportId]`
respectively. Query-parameter encoding (e.g. `?reportId=<uuid>`) MUST NOT
be used. The identifier MUST uniquely resolve to a single report period and
MUST remain stable for the lifetime of that report.

#### Scenario: Lead opens a report and the URL reflects the identifier

- **WHEN** a lead clicks into a report from the sidebar or dashboard
- **THEN** the browser URL contains the report's stable identifier
- **AND** copying the URL and pasting it in a new tab opens the same report

#### Scenario: Lead has two reports open in two browser tabs

- **WHEN** a lead has report A open in tab 1 and report B open in tab 2
- **THEN** each tab's URL contains a distinct identifier
- **AND** the user can distinguish the two reports by URL alone

### Requirement: Report Page Title and Breadcrumb Reflect the Report

The page title (`<title>` element) and the in-app breadcrumb MUST
include identifying metadata for the currently-loaded report (e.g.,
"Week of YYYY-MM-DD — CustomReport"). The metadata MUST update when
the route's identifier changes.

#### Scenario: Lead navigates from report A to report B

- **WHEN** a lead is on report A and clicks a navigation link to report B
- **THEN** the browser tab title updates to reflect report B's period
- **AND** the breadcrumb reflects report B's period

#### Scenario: Lead bookmarks a report URL

- **WHEN** a lead bookmarks the URL of a specific report
- **THEN** opening the bookmark loads that exact report
- **AND** the page title and breadcrumb match what was originally shown
