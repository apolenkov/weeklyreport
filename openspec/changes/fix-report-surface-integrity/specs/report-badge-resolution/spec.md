## ADDED Requirements

### Requirement: Escalation product names resolve report-wide within the authorized read model

Escalation product names MUST resolve report-wide within the authorized
read model. Product names on the report-wide escalation surface (the
Blocked & At Risk rows) MUST resolve report-wide, WITHIN the caller's
authorized read model and the published snapshot — never through an
unscoped query of all projects. Both escalation builders MUST apply this: the live
`buildEscalations` and the snapshot
`buildEscalationsFromSnapshotSections` (`published-report-snapshot.ts`).
A row MUST show the real product name whenever any authorized section or
the portfolio overview can name its project id. The "Unknown"
placeholder MUST appear only for ids that the caller's authorized read
model cannot name; it MUST NOT appear for an archived or out-of-scope
project that the report-wide authorized map can still name.

#### Scenario: a live escalation references a project outside its own section

- **WHEN** `buildEscalations` produces an escalation row whose project id
  is not in its author's own section but is named elsewhere in the
  caller's authorized read model
- **THEN** the row shows the real product name
- **AND** "Unknown" appears only for ids the authorized read model cannot
  name

#### Scenario: a snapshot escalation resolves report-wide

- **WHEN** `buildEscalationsFromSnapshotSections` produces an escalation
  row for the published snapshot
- **THEN** the product name resolves from the report-wide snapshot read
  model, not an unscoped project query
- **AND** "Unknown" appears only for ids the snapshot cannot name
