## ADDED Requirements

### Requirement: Reads of persisted report text do not re-apply author write rules

Report read models, publication snapshots first, MUST accept non-empty text
that the database already holds in item, risk and decision fields and their
stage names, review comments and verdict reasons, item-outcome and resolution
fields, and activity catalogue names, Jira accounts and weekly title overrides without re-applying the visible-content or length rules of the author
write schemas,
and MUST return it exactly as stored, without trimming, normalizing or
replacing it. Server copies of persisted rows (publication snapshots, carry-over
and section merge) MUST follow the same read rule. Author write schemas MUST
keep rejecting such text in every field and stage name they validate.

#### Scenario: A stored row that the current write rule rejects is read

- **GIVEN** a stored report row whose text the current write rule rejects
- **WHEN** publication, a publication snapshot read or projection, the lead form, weekly report, carry-over, the activity catalogue or the PDF render reads it
- **THEN** the read succeeds and returns that text exactly
- **AND** the neighbouring rows of the section are returned unchanged

#### Scenario: The same text is submitted as a new write

- **WHEN** an author submits that text in any item, risk or decision field or stage name
- **THEN** the write is rejected under the existing rule

## MODIFIED Requirements

### Requirement: Shared text boundaries reject selected invisible-only content

Shared `safeText` fields and report stage-name write fields MUST reject values composed only of ECMAScript whitespace and U+00AD, U+034F, U+180E, U+200B–U+200D, U+2060–U+2064 or U+FEFF. Existing null-byte rejection, length bounds, optionality and validation messages MUST remain unchanged. Read models MUST NOT apply this rule to stored values.

#### Scenario: Selected invisible characters cannot provide required text

- **WHEN** a shared text field receives any selected character alone, repeated or mixed with whitespace and the other selected characters
- **THEN** validation rejects it with the existing visible-content message

#### Scenario: Stage-name arrays use the same visible-content boundary

- **WHEN** a report write contains a stage name made only of the selected invisible characters and whitespace
- **THEN** validation rejects the stage name
- **AND** the existing stage-name array bounds and optional write-array policy remain unchanged
- **AND** a read model returns such a stored stage name exactly
