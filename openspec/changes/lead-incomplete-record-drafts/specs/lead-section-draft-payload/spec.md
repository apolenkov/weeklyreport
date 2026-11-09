## MODIFIED Requirements

### Requirement: Draft-save payload drops rows missing any required text field

The draft-save payload MUST include a risk or decision with valid primary text, eligible context, explicit risk severity or authoritative decision owner, even when risk impact, mitigation or decision impact is absent; absent detail is null. Invalid primary text and ineligible context MUST NOT be claimed as saved. An existing incomplete row omitted from a replacement MUST cause rejection of the write unless its stable identity is explicitly deleted; the server enforces this for old clients too. Submission remains strict.

#### Scenario: A risk with a blank impact is excluded from the payload

- **GIVEN** a risk with valid primary text, eligible context, explicit severity, non-empty mitigation and whitespace-only impact
- **WHEN** the section is converted via `sectionToDraftPayload`
- **THEN** the risk is included with null impact and remains visibly incomplete until completed

#### Scenario: A fully-filled risk is included in the payload

- **WHEN** a risk row has non-empty `risk`, `impact`, and `mitigation`
- **THEN** it is included in the payload's `risks` array

#### Scenario: The decisions filter is unchanged

- **WHEN** a decision has valid primary text, eligible context and authoritative owner but no impact
- **THEN** it is included with null impact as an incomplete draft, not presented as complete
- **AND** missing primary text or invalid context is not represented as saved

#### Scenario: Replacement omits a persisted incomplete row

- **WHEN** an old or new client omits a persisted incomplete row without explicit deletion
- **THEN** the server rejects the write without committed mutation
