## ADDED Requirements

### Requirement: Personal history period dates share the Report date admission

The reports.myHistory read model MUST validate Report.periodStart and Report.periodEnd using the same Report date format as compiled history and period lists. Publication, submission and carry-over timestamps MUST retain their own existing contracts.

#### Scenario: Personal history contains a pre-2000 period

- **WHEN** a personal history entry has a period start or end before UTC year 2000
- **THEN** the read boundary rejects that period date

#### Scenario: Nullable timestamps and optional totals remain independent

- **WHEN** personal history has valid period dates with nullable publication or absent optional totals
- **THEN** those fields retain their existing admission and meaning
