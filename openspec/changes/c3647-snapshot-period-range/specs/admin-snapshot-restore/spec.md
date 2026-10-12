## ADDED Requirements

### Requirement: Snapshot periods are ordered on restore

Every snapshot period row and every `publishedSnapshot` offered for restore,
including the retained publication envelope of a reopened report, MUST have
`periodEnd` equal to or later than `periodStart`. The restore input validation
SHALL reject an inverted envelope before the restore transaction starts. The
rule applies to writes only: reading, exporting, archiving, analyzing or
exporting to PDF an already stored snapshot MUST NOT fail because its period is
inverted.

#### Scenario: An inverted period envelope is rejected before restore

- **WHEN** a snapshot period row or its `publishedSnapshot` has `periodEnd` earlier than `periodStart`, including a reopened row whose retained publication envelope is inverted
- **THEN** the restore input validation fails before the restore transaction starts

#### Scenario: A one-day period stays valid

- **WHEN** a snapshot period has `periodStart` equal to `periodEnd`
- **THEN** the restore input validation accepts it

#### Scenario: A stored inverted snapshot stays readable

- **GIVEN** an already stored published snapshot whose `periodEnd` is earlier than `periodStart`
- **WHEN** the snapshot is read for the archive, analytics, history, open work or PDF export, or exported as an admin snapshot
- **THEN** the read succeeds and returns the stored period unchanged
