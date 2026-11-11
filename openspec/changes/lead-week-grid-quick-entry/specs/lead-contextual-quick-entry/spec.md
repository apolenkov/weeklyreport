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

- **WHEN** a Lead uses the single "Risk or decision" start of an editable Product or Activity in the Overview and selects the kind with its kind switch (default Risk)
- **THEN** the record editor opens with that Product or Activity as the parent, without a guessed stage when several are owned, and nothing is created until the Lead saves
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
- **THEN** owner and week remain understandable, actions and focus are reachable with no hover-only control and no document-level horizontal overflow, and failures are announced with a recovery path

### Requirement: Each unit offers one start for a risk or decision

Each editable Product or Activity MUST offer one "Risk or decision" start whose inline composer has a visible kind switch defaulting to Risk. When the unit has records, the start is inside its expanded record list; otherwise it is directly under the unit name.

#### Scenario: A unit without records

- **WHEN** an editable unit has no risks or decisions
- **THEN** "Risk or decision" is shown under the unit name and opens the composer for that unit

#### Scenario: Switching the kind keeps the text

- **WHEN** the Lead types text and switches the kind from Risk to Decision
- **THEN** the text is kept and the required fields change to those of a decision

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

#### Scenario: Required reads briefly fail during a contextual save

- **WHEN** the editor is temporarily unavailable while an existing save or compensation is in flight or queued
- **THEN** the original attempt remains associated with its result through recovery of the same activation
- **AND** its exact scoped receipt confirms the save, or a dropped queue result retains working retry and cancellation without duplicating the request

#### Scenario: A submitted composer becomes read-only

- **WHEN** the report becomes read-only and no transport for the submitted input remains pending
- **AND** the submitted attempt holds no unresolved save outcome: its original and cancellation are neither ambiguous nor needing reconciliation, and no unsent attempt still holds the autosave barrier
- **THEN** the author can explicitly close the editor without compensation or a new write
- **AND** a notice explains that closing does not undo an earlier save and its outcome must be checked in the report
- **WHEN** the report becomes read-only while the submitted attempt holds an unresolved save outcome (an ambiguous or reconciling recovery, or an unsent attempt that still holds the barrier)
- **THEN** the composer stays open with its input and a notice that the save is not resolved, so the engine barrier never outlives its composer
- **AND** the requested cancellation resumes once the report is editable again: an ambiguous original is retried once through its identical request and reconciled before any compensation, and an unsent attempt is restored from its unchanged local lineage before the barrier is released

### Requirement: Each This week and Next week cell has an always-present entry line

Each editable This week and Next week cell of an eligible Product or Activity MUST show an always-present entry line in place of any separate `+ Add` control. The line MUST sit after the cell's last row, and its accessible name MUST be `Add what happened — <unit>, This week` or `Plan something — <unit>, Next week`. Read-only and ineligible cells MUST show no entry line. The line MUST use the canonical item save path, and a failed save MUST keep the typed text with its error.

#### Scenario: An empty editable cell shows only its line

- **WHEN** an editable This week or Next week cell has no record
- **THEN** the cell shows only its entry line, with the placeholder `What happened…` in This week and `Plan…` in Next week

#### Scenario: Keys in the entry line

- **WHEN** the Lead types in an entry line
- **THEN** Enter saves the item, Shift+Enter inserts a line break, and Escape clears the text and offers Undo as defined in `lead-status-overview-actions`
- **AND** leaving the line with non-empty text saves it

#### Scenario: A saved entry keeps the line ready

- **WHEN** an entry is saved successfully
- **THEN** the line is cleared, keeps focus and remains available for the next item of that unit and week

#### Scenario: A failed entry keeps its text

- **WHEN** the save of an entry fails or is refused by validation
- **THEN** the typed text remains in the line with an actionable error, and no success is announced

#### Scenario: Read-only cells have no line

- **WHEN** a cell is Last week, Previously planned, submitted, locked, historical or foreign
- **THEN** no entry line is rendered and the cell states its emptiness in plain language
