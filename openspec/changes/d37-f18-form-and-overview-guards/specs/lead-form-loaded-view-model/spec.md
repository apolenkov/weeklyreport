## ADDED Requirements

### Requirement: The archive-hidden affordance reflects actually removed period rows

The loaded view model's `archivedHidden` flag MUST be true exactly when the
archive filter removed at least one history period row from the visible list.
Archive presence alone, a retained selected archived row, the all-archived
fallback, and an enabled archive toggle MUST NOT set it.

#### Scenario: Only the selected archived row is retained

- **GIVEN** archived history exists and the archive toggle is off
- **WHEN** the selected archived row is kept visible and no other archived
  row exists
- **THEN** `archivedHidden` is false

#### Scenario: A retained selection still hides another archived row

- **WHEN** the selected archived row is kept visible while another archived
  row is filtered out
- **THEN** `archivedHidden` is true

### Requirement: The period breadcrumb resolves only an addressed visible period

The period label for the report breadcrumb MUST resolve a provided non-null
report id only by exact match among the visible periods; a provided-but-
missing id MUST yield no label so the caller renders its neutral fallback.
Only an absent address (null or undefined) MAY fall back to the newest
visible period.

#### Scenario: The addressed report is outside the visible history page

- **WHEN** a provided report id has no exact match among the visible periods
- **THEN** no period label is produced
- **AND** no other period's label is borrowed

#### Scenario: No period is addressed

- **WHEN** the report id is null or undefined
- **THEN** the newest visible period's label is produced
