## MODIFIED Requirements

### Requirement: Feedback deletion MUST be explicit, admin-only, and durable

The workbench MUST expose a `Delete` action only for one visible item when the
server grants the admin capability. Delete MUST require explicit confirmation
and permanently remove the selected item's original content, thread, captures,
and stored evidence. Agentation MUST keep its session and MAY retain only a
content-free terminal tombstone needed to synchronize connected clients and
reject stale client recreation. Delete MUST NOT be available to non-admin
roles or as a bulk operation.

#### Scenario: An admin deletes one Agentation item while its author is connected

- **WHEN** an admin confirms deletion of one visible Agentation item
- **THEN** its annotation, thread, captures, and prior evidence events are
  permanently removed
- **AND** a content-free terminal update tells the connected author client to
  remove the item from local state
- **AND** the Agentation session and unrelated feedback remain unchanged

#### Scenario: A stale client reconnects after deletion

- **WHEN** an authorized client uploads an annotation whose original client ID
  or server ID matches a retained deletion tombstone in that session and author scope
- **THEN** the server returns the terminal dismissed state without recreating
  the annotation or its evidence
- **AND** the client removes the stale local item

#### Scenario: Deletion occurs between the page snapshot and its event connection

- **WHEN** a human client opens a fresh session event stream after loading its page snapshot
- **THEN** the stream replays deletion tombstones through its captured current sequence
  in bounded pages without truncating the overall result
- **AND** ordinary status changes are not replayed as initial deletion signals
- **AND** subsequent events continue after that captured sequence without proxy compression buffering

#### Scenario: Synchronization overlaps deletion

- **WHEN** synchronization and deletion overlap in either order, using either ID
- **THEN** both operations serialize on the session before locking the annotation
- **AND** synchronization before deletion reuses the existing row without duplicates
- **AND** synchronization after deletion returns terminal state without inserting a row

#### Scenario: Different authors use the same client ID

- **WHEN** two authorized authors use the same client ID in a visible session
- **THEN** deleting one author's annotation does not suppress the other's annotation

#### Scenario: A normal updated annotation is synchronized

- **WHEN** an annotation has ordinary update events but no explicit deletion
  tombstone
- **THEN** synchronization MUST NOT classify it as deleted

#### Scenario: A non-admin requests deletion

- **WHEN** a non-admin requests deletion of a visible item
- **THEN** the adapter rejects the command without changing the row

#### Scenario: A caller requests bulk deletion

- **WHEN** any caller requests deletion of multiple feedback items
- **THEN** no bulk command is available or accepted
