# group-scope-isolation-gaps Specification

## Purpose

Confines each surface to the caller's accessible groups: telemetry aggregates are group-scoped and the viewer landing default excludes archived reports. Head lifecycle mutations retain their product-defined cross-group scope.

## Requirements

### Requirement: Telemetry aggregates are scoped to the caller's accessible groups

`telemetry.service.ts`'s summary query MUST apply the caller's group scope
before aggregating counts, using the same `guardGroupScope`/
`groupScopeFilter` pattern the `analytics` module uses. A head or viewer
whose access is restricted to a subset of groups MUST NOT receive counts
that include reports, sections, or reopen requests from groups outside
their access.

#### Scenario: A group-restricted head's summary excludes other groups

- **GIVEN** a head whose session is scoped to group A only
- **AND** reports and sections exist in both group A and group B
- **WHEN** the head requests the telemetry summary
- **THEN** the returned counts include only group A's data
- **AND** exclude group B's reports, sections, and reopen requests

### Requirement: Viewer landing default excludes archived reports

`resolveDefaultReportId`'s viewer-role fallback MUST resolve to the latest
non-archived published report, using the same non-archived resolver the
head-role fallback already uses. It MUST NOT resolve to an archived
published report.

#### Scenario: Viewer's only published report is archived

- **GIVEN** a group whose only published report has been archived
- **AND** no currently-editable report exists for that group
- **WHEN** a viewer in that group requests their default report
- **THEN** `resolveDefaultReportId` does not return the archived report's id

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
