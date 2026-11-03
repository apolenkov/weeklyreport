## ADDED Requirements

### Requirement: Risk and decision entry preserves owner context and required data

A Lead MUST be able to enter risks and decisions inline in an eligible Product or Activity context, using the canonical required fields, ownership, stage and draft rules. Incomplete records MUST NOT be presented as saved, and detailed editing MUST remain available.

#### Scenario: Create a risk for an activity

- **WHEN** the Lead enters a valid risk for an editable Activity and saves it
- **THEN** one risk belongs to that Activity with the supplied required fields and severity
- **AND** no Product parent or Product-stage requirement is fabricated

#### Scenario: An owned Product has no eligible stage

- **WHEN** a contextual record cannot be saved because its Product has no eligible owned stage
- **THEN** the interface explains the missing requirement and retains the input without creating a record

#### Scenario: Decision input is incomplete

- **WHEN** the Lead attempts to submit an incomplete decision
- **THEN** the relevant fields identify what is required, the draft remains available for correction and no successful save is announced

#### Scenario: Responsive and keyboard operation

- **WHEN** a Lead creates an item, risk or decision using keyboard or at 375 CSS pixels
- **THEN** owner and week remain understandable, actions and focus are reachable without hover or document-level horizontal overflow, and failures are announced with a recovery path
