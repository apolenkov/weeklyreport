## Purpose

Allow Leads to quickly create validated records in an authorized Product or Activity context.

## ADDED Requirements

### Requirement: Risk and decision entry preserves owner context and required data

A Lead MUST be able to enter risks and decisions inline in an eligible Product or Activity context, using the canonical required fields, ownership, stage and draft rules. Incomplete records MUST NOT be presented as saved, and detailed editing MUST remain available.

#### Scenario: Required fields and product ownership

- **WHEN** a Lead creates a contextual risk
- **THEN** risk text, impact, mitigation and severity are required
- **WHEN** a Lead creates a contextual decision
- **THEN** decision text, impact and the authoritative section author are required; deadline follows the canonical date rules
- **AND** a Product record requires at least one currently owned eligible stage, with canonical text limits

#### Scenario: Ownership changes before submission

- **WHEN** the selected Product, Activity or stage is no longer eligible before submission
- **THEN** the pending input remains available, the reason is explained and no stage or parent is silently substituted or erased

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

### Requirement: A contextual record is confirmed by its saved identity

Contextual creation MUST retain one stable lineage identity for each intended risk or decision across a save and retry. The UI MUST report success only when the matching scoped server response confirms the intended record and validated fields. Uncertain outcomes MUST be reconciled before retrying, without replacing unrelated records or silently replaying stale data.

#### Scenario: The server remints a physical record ID

- **WHEN** a valid contextual record is saved and returned with a different physical ID
- **THEN** the editor associates the returned record by its submitted stable lineage and confirms that exact record only
- **AND** another record with identical text but a different lineage remains distinct

#### Scenario: A response is lost after the server commits

- **WHEN** a save outcome is uncertain and the Lead retries
- **THEN** the client may retry the exact immutable dispatched request with its original expected version and stable identity
- **AND** a conflict or restriction is reconciled against the authoritative section without replaying the stale whole-section payload at a newer version
- **AND** it does not create a second record, erase subsequent local edits or claim success without confirmation

#### Scenario: Another owned record changes during entry

- **WHEN** another owned record changes while contextual input is pending, retried or discarded
- **THEN** the save or restore acts only on the intended lineage against current state
- **AND** the other record is not silently removed or reverted

#### Scenario: A dispatched create is cancelled

- **WHEN** a Lead cancels a contextual create after its request may have reached the server
- **THEN** the original outcome is reconciled before cancellation is reported complete
- **AND** any confirmed compensation removes only the unchanged intended lineage from current state and is itself persisted and confirmed
- **AND** newer edits and unrelated records are retained, with an explicit conflict if safe compensation is not possible
