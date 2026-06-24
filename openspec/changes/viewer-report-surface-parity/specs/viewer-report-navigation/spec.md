## ADDED Requirements

### Requirement: Viewer has a primary entry to the latest published report it can see

The system SHALL give a viewer a primary navigation entry that resolves to the
latest published report **containing content the viewer can see** through its group
access, rendered read-only at `/reports/[reportId]`. Resolution MUST be group-
content-aware: a published report with no viewer-visible product MUST NOT be the
target. When no such report exists, the entry MUST resolve to an empty state, not
an error or an unpublished period. The existing History entry MUST remain available
alongside it.

The entry is the viewer-safe analogue of the head "Status" link. It MUST be a
stable target (a server-resolved `/reports/latest` redirect) rather than a
hard-coded report id, and it MUST NOT route to the head-only `/head/report`
surface. The published-only gate (`head-report-visibility`) stays in force.

#### Scenario: Latest visible published report opens read-only

- **GIVEN** a viewer with at least one published report containing viewer-visible
  content
- **WHEN** the viewer activates the report entry from the primary navigation
- **THEN** the latest such report opens at `/reports/[reportId]` in read-only mode
- **AND** no editing, publishing, or lifecycle control is rendered

#### Scenario: Published report with no viewer-visible content is skipped

- **GIVEN** the latest published report contains no product the viewer can see, but
  an earlier published report does
- **WHEN** the viewer activates the report entry
- **THEN** the earlier report with viewer-visible content is the target, not the
  empty one

#### Scenario: No visible published report yet

- **GIVEN** a viewer whose accessible groups have no published report with
  viewer-visible content
- **WHEN** the viewer activates the report entry
- **THEN** an empty state is shown ("no published reports yet")
- **AND** no unpublished or draft period is exposed

#### Scenario: History remains available

- **GIVEN** the viewer navigation
- **WHEN** the viewer surface renders
- **THEN** both the report entry and the History entry are present
