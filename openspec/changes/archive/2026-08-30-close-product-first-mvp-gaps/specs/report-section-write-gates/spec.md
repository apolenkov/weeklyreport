## ADDED Requirements

### Requirement: Revoke rechecks archive and editable-period state in the write

The individual `leadForm.revoke` and bulk `leadForm.revokeAllSubmitted` tRPC
procedures MUST persist their section-state transition only when the database
write predicate includes `archived = false` and a canonical period status of
`"open"` or `"reopened"`. A prior application-layer read MUST NOT authorize a
later write after the report is archived or leaves an editable state.

#### Scenario: Archive wins against revoke

- **WHEN** a report becomes archived after `leadForm.revoke` or
  `leadForm.revokeAllSubmitted` begins but before its write commits
- **THEN** no report section is changed
- **AND** the request returns the canonical lifecycle conflict or a zero bulk count

#### Scenario: Submitted section remains editable

- **WHEN** a submitted section belongs to a non-archived report whose canonical
  status is `"open"` or `"reopened"`
- **THEN** an authorized revoke may return it to the permitted editable state
