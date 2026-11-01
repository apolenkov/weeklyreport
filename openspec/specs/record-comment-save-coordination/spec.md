# record-comment-save-coordination Specification

## Purpose

Coordinates record-comment writes with the section save transaction: comment inserts join the save transaction, anchors resolve by stable record lineage, and a stale anchor returns a typed conflict rather than a raw 500.

## Requirements

### Requirement: Comment inserts are coordinated with the section save transaction

`insertComment` MUST resolve its anchor and write the `RecordComment` inside
a single transaction that is ordered against `saveSection`'s lock — either by
taking the same `Report` row `FOR UPDATE` lock `saveSection` uses, or by
performing a `ReportSection.version` compare-and-set. A comment write MUST
NOT be able to commit unserialized between `saveSection`'s comment capture
and its delete-recreate of the target record.

#### Scenario: A comment written mid-save is not silently lost

- **GIVEN** a `saveSection` transaction has captured existing comments but
  has not yet completed its delete-recreate of the target record
- **AND** a reviewer posts a comment on that record concurrently
- **WHEN** both operations complete
- **THEN** the comment is either preserved through the recreate or the
  comment write observes a version conflict and returns a typed error
- **AND** the comment is never silently dropped

### Requirement: Comment anchors resolve by stable record lineage

`insertComment`'s anchor resolution MUST key off the target record's durable
stableId lineage, not its current raw primary key, so a comment posted while
a concurrent `saveSection` has already recreated the record's row still
anchors to the correct logical record.

#### Scenario: Anchor resolves after the record's PK has been recreated

- **GIVEN** a record whose PK was recreated by a `saveSection` delete-recreate
  after the comment's target was first identified
- **WHEN** the comment is inserted
- **THEN** it anchors to the record via its stableId lineage
- **AND** it is not orphaned by the PK change

### Requirement: A stale comment anchor returns a typed conflict, never a raw 500

`insertComment` MUST catch a Prisma foreign-key violation (`P2003`) raised
when a comment's anchor no longer exists at insert time and return a typed
conflict/not-found error. It MUST NOT let the raw database error surface to
the caller.

#### Scenario: Comment insert against a deleted anchor

- **GIVEN** the target Item/Risk/Decision has already been deleted by a
  concurrent `saveSection`
- **WHEN** `insertComment` is called against that anchor's stale PK
- **THEN** it returns a typed conflict/not-found error
- **AND** no unhandled `P2003` reaches the caller

### Requirement: A pending comment add locks its submitted draft

A record review comment composer MUST disable its textarea while an add request
is pending. Success MAY clear the submitted text; failure MUST retain it and
restore editing. An earlier success MUST NOT discard text accepted after submit.

#### Scenario: Comment add is pending

- **GIVEN** a reviewer submits a comment
- **WHEN** the add request is pending
- **THEN** the textarea cannot accept new text
- **AND** the submitted text remains visible

#### Scenario: Comment add fails

- **WHEN** the add request fails
- **THEN** the submitted text remains available for editing or retry

### Requirement: Review comment composition MUST enforce the shared text boundary locally

The review-comment composer MUST expose an associated 2,000-character limit derived from the shared review schema. Empty or invisible-only comments and comments over the limit MUST block mutation with concise field feedback. Over-limit input MUST remain available for correction, and serialized server validation details MUST NOT be displayed to the user.

#### Scenario: A reviewer pastes an over-limit comment

- **WHEN** a reviewer pastes 2,001 characters into a review comment
- **THEN** the complete draft remains visible with associated limit feedback
- **AND** no comment mutation runs

#### Scenario: A reviewer submits a boundary-valid comment

- **WHEN** a reviewer submits 2,000 visible characters
- **THEN** exactly one comment mutation carries the valid anchor and full text

#### Scenario: Server validation rejects a comment

- **WHEN** the comment mutation returns serialized validation details
- **THEN** the composer preserves the draft and shows concise user-facing feedback
- **AND** raw serialized validation output is not rendered

### Requirement: A delete confirmation follows the live comment and permission

An open review-comment delete confirmation with no delete in flight MUST close
without deleting when its comment is no longer in the record's current comment
list or the current actor may no longer delete that comment. A confirmation
whose delete is in flight MUST stay open until that delete settles. The server MUST remain the authority
for every delete.

#### Scenario: Review rights are withdrawn while the confirmation is open

- **WHEN** a reviewer has the delete confirmation open and the refreshed
  record no longer grants that reviewer review rights
- **THEN** the confirmation closes and no delete is requested

#### Scenario: The comment is removed elsewhere

- **WHEN** the comment under confirmation disappears from the refreshed list
- **THEN** the confirmation closes and no delete is requested

#### Scenario: The list refreshes while the delete is in flight

- **WHEN** the reviewer confirmed the delete and a refreshed list drops the
  comment before the delete settles
- **THEN** the confirmation stays open until the delete settles and then
  reports its outcome

### Requirement: The comment composer description keeps every live reference

The review-comment text field's accessible description MUST include the
character counter, the validation error while one is shown, and the feedback
message while one is shown. A validation error MUST NOT remove the feedback
reference. The limit hint MUST stay present while a validation error shows,
and the validation error MUST be a separate element carrying `role="alert"`.

#### Scenario: A delete outcome shows beside a draft error

- **WHEN** a reviewer holds an invisible-only draft and deletes a comment
- **THEN** the field's description contains the validation error and the
  delete outcome
- **AND** the field stays marked invalid

#### Scenario: A valid draft with feedback

- **WHEN** a reviewer holds a valid draft and a delete outcome is shown
- **THEN** the field's description contains the counter and the delete outcome
- **AND** the field is not marked invalid

#### Scenario: The hint survives a validation error

- **WHEN** the draft becomes invalid
- **THEN** the limit hint remains and the validation error is announced from
  its own `role="alert"` element
