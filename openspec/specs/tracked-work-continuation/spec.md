# tracked-work-continuation Specification

## Purpose
Let leads continue and develop the same tracked work across weekly report projections while preserving results, comments and immutable published history.

## Requirements

### Requirement: Current to Next preserves the Current result

The Overview continuation action MUST keep the Current result visible and unchanged while creating or editing a linked Next continuation under the same stable lineage. It MUST NOT create an independent copy or remove Current.

Completed records MUST reject continuation creation and promotion through both UI actions and command validation.

#### Scenario: Continue a result

- **WHEN** a lead continues Current result R with next text N and saves
- **THEN** Current displays R and Next displays N
- **AND** both resolve to the same tracked-work lineage after save and refetch

#### Scenario: Cancel new continuation

- **WHEN** a lead opens continuation entry and cancels
- **THEN** Current and Next remain unchanged and no save or history entry is committed

#### Scenario: Completed record cannot acquire a commitment

- **WHEN** a continuation or promotion is attempted for a completed record
- **THEN** no mutation occurs and the record remains completed without a new commitment

### Requirement: Promotion preserves previous results

The Overview promotion action MUST make a linked continuation the current work, preserve the superseded result in readable history and consume the continuation atomically. A standalone Next item MUST preserve its own lineage when promoted.

Promoted work MUST be current and in progress, with no active pause reason and no carry-over flag. The previous lifecycle state and pause reason MUST remain in history together with the previous text.

#### Scenario: Promote linked Next

- **WHEN** the lead promotes N over active Current result R
- **THEN** Current displays N, history retains R and the consumed Next projection disappears
- **AND** comments remain attached to the same lineage

#### Scenario: Promote previously paused work

- **WHEN** an eligible paused record's continuation is promoted
- **THEN** the active work is current and in progress without an active pause reason or carry-over flag
- **AND** history retains the previous paused state, reason and result

### Requirement: Continuation conflicts require explicit selection

The continuation form MUST show conflicting same-lineage texts and require an explicit selection. The nonselected text MUST remain in history; cancellation MUST leave both texts untouched. A failed or stale save MUST preserve recoverable intent without overwriting newer data.

#### Scenario: Existing continuation differs

- **WHEN** an action proposes N2 for a lineage already carrying N1
- **THEN** no silent replacement occurs
- **AND** confirmation selects the active continuation while retaining the displaced text in history

### Requirement: Pointer keyboard and menu share observable behavior

Overview MUST provide equivalent pointer, keyboard and menu continuation/promotion actions. Invalid drops and Escape MUST cancel without persistence and restore initiating focus. Read-only, foreign and historical published rows MUST reject mutations through every path.

#### Scenario: Keyboard parity and cancellation

- **WHEN** a lead performs the same continuation using keyboard and pointer on equivalent fixtures
- **THEN** the resulting text, lineage and history match
- **WHEN** the action is cancelled or targets a noneditable row
- **THEN** no report mutation is committed

### Requirement: Continuation preserves existing row ordering

Continuation and promotion MUST NOT change Overview row ordering, text or workflow status: the Overview keeps rendering the existing collection order, and a linked projection keeps resolving to its source record's stable identity in every lane. Persisting a dragged row position is out of scope and requires its own ordering field.

#### Scenario: Order survives continuation and promotion

- **WHEN** a lead continues a Current result and later promotes the linked continuation
- **THEN** the collection order, the other rows' texts and statuses and the source lineage are unchanged after refetch
- **AND** no ordering field, fractional index or reorder endpoint is written

### Requirement: Comments and development history survive continuation operations

The tracked-work detail surface MUST show committed development history and comments for the same lineage. Leads MUST be able to comment on their own editable records using server-derived identity. Existing reviewer permissions and comment/save coordination MUST remain intact. Published snapshots MUST NOT change after live continuation operations.

#### Scenario: Comment concurrent with canonical save

- **WHEN** an authorized comment is submitted while a continuation save recreates the row
- **THEN** the comment is preserved under stable lineage or a typed recoverable conflict is returned
- **AND** no comment is silently lost and prior published snapshots remain unchanged
