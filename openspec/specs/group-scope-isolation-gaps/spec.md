# group-scope-isolation-gaps Specification

## Purpose

Confines each surface to the caller's accessible groups: telemetry aggregates are group-scoped and the viewer landing default excludes archived reports. Head lifecycle mutations retain their product-defined cross-group scope.

## Requirements

### Requirement: Telemetry aggregates are scoped to the caller's accessible groups

`telemetry.service.ts`'s summary query MUST apply the caller's group scope
before aggregating counts. Editable current and reopened periods use live
section ownership. Settled published and archived metrics use the validated
immutable snapshot plus indexed `PublishedSectionScope`; they MUST NOT depend
on mutable section or user rows. A head or viewer
whose access is restricted to a subset of groups MUST NOT receive counts
that include reports, sections, or reopen requests from groups outside
their access.

#### Scenario: A group-restricted head's summary excludes other groups

- **GIVEN** a head whose session is scoped to group A only
- **AND** reports and sections exist in both group A and group B
- **WHEN** the head requests the telemetry summary
- **THEN** the returned counts include only group A's data
- **AND** exclude group B's reports, sections, and reopen requests

#### Scenario: Settled telemetry survives recovery without live sections

- **GIVEN** recovery restores a settled report, its immutable publication snapshot, and its frozen scope projection
- **AND** no live section rows exist for that report
- **WHEN** an authorized group requests active-lead, late-section, on-time, report-count, or PDF-export telemetry
- **THEN** settled metrics retain their publication-time values and scope
- **AND** unauthorized groups remain excluded

#### Scenario: Headline queries remain bounded

- **WHEN** telemetry resolves the latest visible period or counts recent PDF exports
- **THEN** PostgreSQL applies frozen-or-live report admission and performs a bounded `findFirst` or aggregate count
- **AND** the API does not materialize the complete report history, snapshot corpus, or PDF-job list in memory

### Requirement: Viewer landing default excludes archived reports

`WeeklyReportService.latestForViewer` MUST fall back through
`getLatestPublishedVisibleId` to the latest non-archived published report that
is visible to the caller. It MUST NOT resolve to an archived published report.

#### Scenario: Viewer's only published report is archived

- **GIVEN** a group whose only published report has been archived
- **AND** no currently-editable report exists for that group
- **WHEN** a viewer in that group requests their default report
- **THEN** `latestForViewer` does not return the archived report's id

### Requirement: Head lifecycle mutations retain their product-defined scope

This capability MUST NOT add a group-scope guard to head lifecycle mutations
(`archivePeriod`, `unarchivePeriod`, or any other archive-router write).
Cross-group head archive/unarchive access is the current product decision.

#### Scenario: Head archives a report outside their primary group

- **GIVEN** a head account with lifecycle-mutation access
- **WHEN** that head calls `archivePeriod` or `unarchivePeriod` for a report
  outside the group they primarily work in
- **THEN** the mutation is permitted by design
- **AND** this remains permitted by the current product scope
