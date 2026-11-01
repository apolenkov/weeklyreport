# lead-form-overview-activation Specification

## Purpose

Defines how Overview acknowledgements, asynchronous writes and lineage responses stay bound to the section activation and report that issued them.

## Requirements

### Requirement: Overview create acknowledgement follows persisted identity

After an inline Overview create succeeds, the editor MUST recognize the
server-recreated Item as the submitted row and close the composer without
showing unsaved-input recovery. Recognition MUST require the canonical identity
mapping for that submission's temporary client id from the exact persisted
payload to a server id/stableId, the same authored fields, week and parent, the
same editor generation and save-receipt scope, a later receipt sequence, a newer
confirmed section version and the same submission attempt. Text equality alone
MUST NOT acknowledge a create.

Failure, conflict, ambiguous identity, generation replacement or later field
changes MUST retain the submitted input in the existing recovery flow and MUST
NOT overwrite the current draft.

#### Scenario: A successful create receives server identities

- **GIVEN** an Overview create holds a temporary client row id
- **WHEN** save succeeds and reconciliation replaces it with a server id and a new stableId
- **THEN** the matching submitted composer closes without unsaved-input recovery
- **AND** the current draft contains exactly one created row

#### Scenario: An apparent match lacks the attempt acknowledgement

- **WHEN** text matches another row but the stable identity, version, generation,
  successful-save timestamp or submission attempt does not confirm the create
- **THEN** the editor does not treat that text match as success
- **AND** the existing recovery input remains available without overwriting the draft

#### Scenario: An earlier identical create finishes first

- **GIVEN** create A is in flight and an identical Overview create B is queued
- **WHEN** A receives its server identity while B is still pending
- **THEN** A's receipt does not close B's composer
- **AND** a failure of B retains B's input for a retry without adding a duplicate
- **AND** only B's successful receipt may close B's composer

### Requirement: Asynchronous writes belong to one section activation

The lead draft engine MUST accept autosave and submit completions only for the
section activation that issued them. Leaving a section and returning to it MUST
create a distinct activation. Obsolete completions MUST NOT change the current
version, draft, saved baseline, submitted status or error recovery messages.

#### Scenario: A prior section's autosave settles while a new section has queued edits

- **GIVEN** section A has a pending autosave and section B is loaded with its own version and queued edits
- **WHEN** A's save succeeds or fails
- **THEN** B's queued payload is saved with B's current version
- **AND** A's result does not stamp B's baseline or show A's failure on B
- **AND** ordinary navigation to B is not treated as a conflicting external edit of A

#### Scenario: A queued request retains its original section after navigation

- **GIVEN** A has a pending save and another queued save before navigation loads B
- **WHEN** A's first save succeeds and the queued request has not been replaced
- **THEN** the queued payload is saved to A with A's confirmed version and identities
- **AND** neither completion changes B's draft state or version

#### Scenario: The user returns to a section before its old write settles

- **GIVEN** a write starts on A and navigation loads B and then A again
- **WHEN** the original A write settles
- **THEN** its completion cannot update the new A activation
- **AND** any current queued save retains the new activation's version and content

#### Scenario: Submit completes after navigation

- **GIVEN** submit starts on A and navigation loads B
- **WHEN** A's submit succeeds or fails
- **THEN** B retains its draft version and submitted status
- **AND** no submit success or error recovery is announced for B

#### Scenario: A current section's save succeeds

- **WHEN** an autosave succeeds for the still-current activation
- **THEN** its confirmed version and identities reconcile before the next queued save
- **AND** the existing same-section save-echo behavior is preserved

#### Scenario: Conflict recovery finishes after navigation

- **GIVEN** conflict recovery begins for A and navigation loads B before its refetch settles
- **WHEN** the refetch resolves or rejects
- **THEN** A's reload message is not announced on B

### Requirement: Overview plan completion MUST preserve newer retained input

An asynchronous Overview plan outcome or restore completion MUST close retained
input only when it belongs to the same item, editor generation, canonical
request input, command ID, and attempt owner recorded for that retained
composer. A success announcement MUST additionally require the completing
attempt owner to remain mounted. If the hook remounts and the retained fields
change or a newer attempt starts, an older completion MUST NOT close that
composer or announce success.

An unchanged explicit retry MUST retain its existing idempotent command ID.
Changing the canonical request input MUST create a new command identity, and
only that new attempt may close and announce its successful result. Existing
failure retention and unknown current-source recovery MUST remain unchanged.

#### Scenario: Old success arrives after retained input changes

- **GIVEN** an Overview plan command is pending when its route child remounts
- **AND** the lead edits the retained plan fields after the remount
- **WHEN** the old command succeeds
- **THEN** the edited retained composer remains open with the new input
- **AND** the obsolete hook owner does not announce success

#### Scenario: A newer changed attempt succeeds after the old attempt

- **GIVEN** a remounted composer contains changed canonical input
- **WHEN** the lead submits it while the old command is still unresolved
- **AND** the old command completes before the new command
- **THEN** the old completion does not close the new attempt
- **AND** the new attempt has a different command ID
- **AND** only the new completion closes the composer and announces success

#### Scenario: An unchanged retained prior-source request is retried

- **WHEN** a prior-source request is retained after an unknown acknowledgement
  and retried without field changes
- **THEN** the retry uses the original command ID and immutable source
- **AND** its successful completion closes the matching composer

#### Scenario: A current-source attempt remounts with an unknown outcome

- **WHEN** a current-source attempt owner changes before its outcome is known
- **THEN** the existing recovery block prevents another write
- **AND** the retained input remains available for confirmation and recovery

### Requirement: Lineage responses MUST belong to the issuing section activation

Resolve and restore completions MUST update the local version, draft, and saved
baseline only while their issuing command owns the current section activation.
Changing sections or unmounting MUST invalidate that ownership. Returning to
the same section MUST NOT reactivate an old command. A refreshed read within
the same activation MUST retain valid command ownership and existing version
checks. Server command identity and explicit retry semantics MUST remain unchanged.

#### Scenario: A lineage response arrives after changing sections

- **GIVEN** resolve or restore starts on section A
- **WHEN** section B becomes active before the response arrives
- **THEN** the response changes neither the local version nor the adopted section

#### Scenario: The form returns before its old lineage response arrives

- **GIVEN** resolve or restore starts on A and navigation activates B and then A
- **WHEN** the original command completes
- **THEN** it does not update the version, draft, or saved baseline of the new A activation

#### Scenario: A lineage owner unmounts before completion

- **GIVEN** resolve or restore is pending when its form owner unmounts
- **WHEN** the response arrives
- **THEN** it does not invoke local version acceptance or server-section adoption

#### Scenario: The current activation receives a refreshed read

- **GIVEN** resolve or restore is pending and a read refreshes the same active section
- **WHEN** the response arrives without leaving that activation
- **THEN** existing version checks permit adoption of the valid response
