## Purpose

Allow Leads to quickly create validated records in an authorized Product or Activity context.

## ADDED Requirements

### Requirement: Risk and decision entry preserves owner context and required data

A Lead MUST be able to enter minimum-input risk and decision drafts inline under `lead-incomplete-record-drafts`. One action focuses primary text; details expand on demand. Only matching persistence confirms a saved incomplete draft. Parent, stage, severity and owner rules remain authoritative; section submission requires completion or explicit deletion.

#### Scenario: Required fields and product ownership

- **WHEN** a Lead creates a contextual risk
- **THEN** risk text, eligible context and explicit severity are required for draft save; missing impact and mitigation are null
- **WHEN** a Lead creates a contextual decision
- **THEN** decision text, eligible context and the authoritative section author are required for draft save; missing impact is null and deadline follows the canonical date rules
- **AND** a Product record requires at least one currently owned eligible stage, with canonical text limits

#### Scenario: A record is started from its reporting unit

- **WHEN** a Lead uses the Risk or Decision start of an editable Product or Activity in the Overview
- **THEN** the record editor opens with that Product or Activity as the parent, without a guessed stage, and nothing is created until the Lead saves
- **AND** a read-only or historical unit offers no such start

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

- **WHEN** the Lead saves valid decision text and context without impact
- **THEN** a matching receipt confirms “Saved draft — needs details” and reload retains null impact
- **AND** attempting section submission identifies missing impact and preserves the draft without claiming submission success

#### Scenario: Responsive and keyboard operation

- **WHEN** a Lead creates an item, risk or decision using keyboard or at 375 CSS pixels
- **THEN** owner and week remain understandable, actions and focus are reachable without hover or document-level horizontal overflow, and failures are announced with a recovery path

### Requirement: A contextual record is confirmed by its saved identity

Each intended contextual risk or decision MUST retain one stable lineage through save and retry. Success requires a matching scoped server response. The identical captured request MAY be retried at its original version to resolve uncertainty; changed-payload or new-version retries, success and cancellation claims require reconciliation first.

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

#### Scenario: A contextual save never reaches dispatch

- **WHEN** a pending report command refuses the local patch, or a failed earlier save removes the contextual attempt from the queue before dispatch
- **THEN** the composer retains its input and offers a functioning retry and cancellation path without reporting success
- **AND** an unchanged local patch from the dropped attempt is restored before its save barrier is released; unrelated records and later typing remain intact

#### Scenario: A submitted composer survives page navigation

- **WHEN** a submitted composer is retained across navigation and the returning editor has a new activation
- **THEN** its old request is not replayed or compensated through the new activation
- **AND** the author can explicitly close the retained editor with a notice that closing does not undo the earlier save and that its outcome must be checked in the report
