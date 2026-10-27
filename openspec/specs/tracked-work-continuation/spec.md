# tracked-work-continuation Specification

## Purpose

Keep continuation and promotion of tracked work safe across weekly report projections while preserving results, comments and immutable published history. The linked-continuation Overview surface (Continue and Promote actions, drag handle) was rejected and removed; Status Overview authoring uses one canonical item editor with explicit week placement (see `lead-status-overview-actions`). These requirements cover the retained command, history and legacy-data paths, which MUST NOT gain additional Status Overview entry points.

## Requirements

### Requirement: Current to Next preserves the Current result

A continuation command MUST keep the Current result unchanged while creating or editing the Next commitment under the same stable lineage. It MUST NOT create an independent copy or remove Current.

Completed records MUST reject continuation creation and promotion through command validation.

#### Scenario: Continue a result

- **WHEN** a continuation command records next text N on Current result R and saves
- **THEN** Current keeps R and the commitment N resolves to the same tracked-work lineage after save and refetch

#### Scenario: Completed record cannot acquire a commitment

- **WHEN** a continuation or promotion is attempted for a completed record
- **THEN** no mutation occurs and the record remains completed without a new commitment

### Requirement: Promotion preserves previous results

A promotion command MUST make a continuation the current work, preserve the superseded result in readable history and consume the continuation atomically. A standalone Next item MUST preserve its own lineage when promoted.

Promoted work MUST be current and in progress, with no active pause reason and no carry-over flag. The previous lifecycle state and pause reason MUST remain in history together with the previous text.

#### Scenario: Promote linked Next

- **WHEN** promotion applies N over active Current result R
- **THEN** Current holds N, history retains R and the consumed Next projection disappears
- **AND** comments remain attached to the same lineage

#### Scenario: Promote previously paused work

- **WHEN** an eligible paused record's continuation is promoted
- **THEN** the active work is current and in progress without an active pause reason or carry-over flag
- **AND** history retains the previous paused state, reason and result

### Requirement: Continuation conflicts never overwrite silently

A command that proposes a continuation text for a lineage already carrying a different one MUST NOT replace it silently. The nonselected text MUST remain in history. A failed or stale save MUST preserve recoverable intent without overwriting newer data.

#### Scenario: Existing continuation differs

- **WHEN** a command proposes N2 for a lineage already carrying N1
- **THEN** no silent replacement occurs
- **AND** an explicit selection keeps one text active while retaining the displaced text in history

### Requirement: Continuation preserves existing row ordering

Continuation and promotion MUST NOT change Overview row ordering, text or workflow status: the Overview keeps rendering the existing collection order, and a linked projection keeps resolving to its source record's stable identity in every lane. Persisting a dragged row position is out of scope and requires its own ordering field.

#### Scenario: Order survives continuation and promotion

- **WHEN** a Current result is continued and the continuation is later promoted
- **THEN** the collection order, the other rows' texts and statuses and the source lineage are unchanged after refetch
- **AND** no ordering field, fractional index or reorder endpoint is written

### Requirement: Comments and development history survive continuation operations

The tracked-work detail surface MUST show committed development history and comments for the same lineage. Leads MUST be able to comment on their own editable records using server-derived identity. Existing reviewer permissions and comment/save coordination MUST remain intact. Published snapshots MUST NOT change after live continuation operations.

#### Scenario: Comment concurrent with canonical save

- **WHEN** an authorized comment is submitted while a continuation save recreates the row
- **THEN** the comment is preserved under stable lineage or a typed recoverable conflict is returned
- **AND** no comment is silently lost and prior published snapshots remain unchanged
