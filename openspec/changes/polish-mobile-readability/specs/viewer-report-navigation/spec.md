## ADDED Requirements

### Requirement: Published document headers show publication state once

The shared read-only document surface at `/reports/[reportId]` MUST show one
visible publication-state indicator for a published report, through its
canonical report-header lifecycle badge. `ViewerAuthorityLabel` MUST NOT add a
second Published badge in document mode. Open and reopened working-report
authority context MUST remain visible, and Slides MUST retain their standalone
authority context when the document lifecycle badge is absent. Badge selection
MUST NOT change report lifecycle or access policy.

#### Scenario: A published report opens in document mode

- **WHEN** a visitor reads a published report at `/reports/[reportId]` in document mode
- **THEN** exactly one Published indicator appears in the header alongside its submission ratio

#### Scenario: Working or slide context is needed

- **WHEN** the read-only surface shows an open or reopened working report, or a published report in Slides
- **THEN** its existing working-report or standalone slide authority context remains visible
