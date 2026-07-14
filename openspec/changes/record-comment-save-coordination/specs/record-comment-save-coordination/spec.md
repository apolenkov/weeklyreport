## ADDED Requirements

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
