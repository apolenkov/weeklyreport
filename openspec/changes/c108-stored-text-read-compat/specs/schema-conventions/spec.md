## ADDED Requirements

### Requirement: Reads of persisted report text do not re-apply author write rules

Report read models, publication snapshots included, MUST accept non-empty text
that the database already holds in item, risk and decision fields and their
stage names, review comments and verdict reasons, item-outcome and resolution
fields without re-applying the visible-content or length rules of the author
write schemas,
and MUST return it exactly as stored, without trimming, normalizing or
replacing it. Server copies of persisted rows (publication snapshots, carry-over
and section merge) MUST follow the same read rule. Author write schemas MUST
keep rejecting such text in every field and stage name they validate.

#### Scenario: A stored row that the current write rule rejects is read

- **GIVEN** a stored report row whose text the current write rule rejects
- **WHEN** the lead form, weekly report, publication snapshot, carry-over or PDF render reads it
- **THEN** the read succeeds and returns that text exactly
- **AND** the neighbouring rows of the section are returned unchanged

#### Scenario: The same text is submitted as a new write

- **WHEN** an author submits that text in any item, risk or decision field or stage name
- **THEN** the write is rejected under the existing rule
