## RENAMED Requirements

- FROM: `### Requirement: Lead Report URLs Include a Stable Report Identifier`
- TO: `### Requirement: Report URLs Encode the Report Identifier as a Path Segment`

## MODIFIED Requirements

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
