# feedback-capture-and-lifecycle Specification

## Purpose

Defines bounded role-scoped feedback capture, inbox triage, explicit lifecycle actions, safe dismissal, durable admin deletion and focus handling after removal.

## Requirements

### Requirement: Capture MUST be bounded and role-scoped

The adapter MUST accept the published annotation shape, including placement and
rearrange records, with the existing bounded annotation-content limits. It MUST
support create, edit, pending, acknowledge, resolve, dismiss, thread reply,
action request, and the documented SSE event types. Creates MUST be retry-safe
by stable client ID. Agentation DELETE compatibility MUST be non-destructive.

#### Scenario: A client retries a create

- **WHEN** the same authorized client ID is submitted twice
- **THEN** exactly one PostgreSQL record is created and both responses are
  retry-safe

#### Scenario: A user submits captured context

- **WHEN** an authenticated user submits valid bounded annotation context,
  including placement or rearrange records
- **THEN** PostgreSQL persists it under the same role/group predicates

#### Scenario: A client supplies oversized or malformed capture

- **WHEN** a request exceeds body or annotation-content limits
- **THEN** the adapter rejects it before persistence

#### Scenario: The viewed URL has sensitive query data

- **WHEN** feedback is created from a URL containing query or fragment data
- **THEN** only the normalized pathname is persisted

#### Scenario: A user invokes the fast contextual path

- **WHEN** the user starts a right-click comment
- **THEN** the composer opens on the targeted element without showing the drawing-instruction toolbar

#### Scenario: The Agentation toolbar deletes an annotation

- **WHEN** the authenticated stock Agentation client sends its compatibility
  DELETE for an annotation
- **THEN** the adapter records the configured resolved/dismissed transition
- **AND** the feedback row, legacy row, thread, and captured evidence remain

#### Scenario: The adapter emits an event

- **WHEN** a permitted create, update, delete-compatible transition, thread, or
  action occurs
- **THEN** it emits the documented event name and JSON payload with sequence ID
- **AND** reconnecting with `Last-Event-ID` receives the missing events only

### Requirement: The feedback inbox MUST support operational triage

The authenticated `/feedback` surface MUST present each visible record as an
operational work item with a labeled lifecycle status, actor/timestamp,
normalized page context, and an accessible path to detail. Detail MUST
separate the original annotation content from the append-only thread and
captured evidence. Only the exact author MAY edit that original content.
The workbench MUST NOT provide `Open context`, `Open live page`, or any other
navigation from a feedback item to the originating page. Recorded context,
captures, and thread MUST remain available inline in the detail view.

#### Scenario: An authorized reviewer opens a feedback item

- **WHEN** an authorized admin, head, lead, or other configured inbox role
  selects a visible record
- **THEN** the workbench shows its status, original author, original content,
  normalized context, evidence, and thread within the same feedback workflow
- **AND** no record outside the caller's server-authorized scope is disclosed

#### Scenario: A reviewer views recorded context

- **WHEN** an authorized reviewer opens an item's details
- **THEN** the app shows the recorded pathname, session/annotation identifiers,
  captures, and thread inline
- **AND** no control navigates to the originating page

### Requirement: Lifecycle actions MUST be explicit and capability-scoped

The workbench MUST label and expose the supported lifecycle states as `New`,
`Acknowledged`, `Resolved`, and `Dismissed`. It MUST expose only actions
allowed by the existing server-derived role, group, and ownership predicates.
The author MAY edit their own original annotation and reply to its thread when
domain rules permit; admins and heads MAY triage and reply to visible records
but MUST NOT rewrite a foreign original. Replies remain append-only evidence.

#### Scenario: An author edits their own original

- **WHEN** an authenticated author edits an editable annotation they own
- **THEN** the adapter updates only that author's original content and returns
  the current record

#### Scenario: A reviewer attempts to rewrite a foreign original

- **WHEN** an admin, head, or other reviewer submits an edit for an annotation
  they do not own
- **THEN** the adapter rejects the edit without changing the original content

#### Scenario: A reviewer replies

- **WHEN** an authorized reviewer submits a bounded reply
- **THEN** the adapter appends it with the server-derived actor and timestamp
- **AND** the original annotation remains unchanged

### Requirement: Dismissal MUST be safe and non-destructive

The workbench MUST provide a confirmed `Dismiss` action only when permitted.
Dismissal MUST require a non-empty bounded reason, append that reason with the
server-derived actor, transition the lifecycle to `Dismissed`, and retain the
record, original content, thread, and captured evidence. No bulk mutation
controls MUST be exposed or accepted as workbench commands.

#### Scenario: A reviewer dismisses with a reason

- **WHEN** an authorized reviewer confirms Dismiss with a valid reason
- **THEN** the record transitions to `Dismissed` and the reason is retained as
  append-only evidence
- **AND** the original record and captures remain readable

#### Scenario: A reviewer dismisses without a reason

- **WHEN** a reviewer submits an empty or whitespace-only dismiss reason
- **THEN** the adapter rejects the request and leaves lifecycle and evidence
  unchanged

#### Scenario: A caller requests bulk mutation

- **WHEN** a caller requests bulk status or deletion through the workbench
- **THEN** the request is rejected or unavailable
- **AND** no visible or historical feedback row is removed or changed

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

### Requirement: Focus MUST NOT be lost when Dismiss or Delete removes the acting control

When a confirmed Dismiss or Delete removes the control that opened its workflow
(the Dismiss action of a now-dismissed record, or the whole record card),
keyboard focus MUST move to a stable control in the workbench instead of being
dropped to the document body. Dismiss MUST move focus to the `Details` button of
the same record. Delete MUST move focus to the `Details` button of the adjacent
record (the next, otherwise the previous) or, when no record remains, to the list
heading. A cancelled or failed workflow MUST keep returning focus to its opener.

#### Scenario: Dismiss keeps focus on the record

- **GIVEN** a reviewer confirmed Dismiss with a reason and the record now shows
  `Dismissed`
- **WHEN** the dismissal succeeds
- **THEN** the record's `Details` button has focus

#### Scenario: Delete moves focus to the next record

- **GIVEN** an admin deletes a record that has a following record in the list
- **WHEN** the deletion succeeds
- **THEN** the following record's `Details` button has focus

#### Scenario: Deleting the last record moves focus to the previous record

- **WHEN** an admin deletes the last record of a list with earlier records
- **THEN** the previous record's `Details` button has focus

#### Scenario: Deleting the only record moves focus to the heading

- **WHEN** an admin deletes the only listed record
- **THEN** the list heading `Feedback` has focus

#### Scenario: A failed Delete keeps the dialog and its focus

- **WHEN** the delete request fails
- **THEN** the confirmation stays open and focus does not move to another record
