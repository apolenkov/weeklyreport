## MODIFIED Requirements

### Requirement: Capture MUST be bounded and role-scoped

The adapter MUST accept the published annotation shape, including placement and
rearrange records, with the existing bounded annotation-content limits. It MUST
support create, edit, pending, acknowledge, resolve, dismiss, thread reply,
action request, and the documented SSE event types. Creates MUST be retry-safe
by stable client ID. Agentation DELETE compatibility MUST be non-destructive.

An annotation thread MUST hold at most `AGENTATION_MAX_ARRAY_LENGTH` (50)
messages, so the stored thread always satisfies the response contract that
retry-safe creates and delivery confirmation parse. A reply MUST be rejected
before persistence once the thread holds `AGENTATION_MAX_ARRAY_LENGTH - 1`
messages: the last slot is reserved for the dismissal reason. A rejected write
answers 409 and stores no message or event.

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

#### Scenario: A thread reaches its reply limit

- **WHEN** an authorized user replies to an annotation whose thread holds 49 messages
- **THEN** the adapter answers 409 before persistence
- **AND** no thread message or event is stored

### Requirement: Dismissal MUST be safe and non-destructive

The workbench MUST provide a confirmed `Dismiss` action only when permitted.
Dismissal MUST require a non-empty bounded reason, append that reason with the
server-derived actor, transition the lifecycle to `Dismissed`, and retain the
record, original content, thread, and captured evidence. No bulk mutation
controls MUST be exposed or accepted as workbench commands.

Dismissal MUST be accepted while the thread holds fewer than
`AGENTATION_MAX_ARRAY_LENGTH` messages, which the reply reservation guarantees
for every thread except one that was reopened and dismissed repeatedly up to
the limit. Dismissing such a full thread MUST be rejected with 409 and change
nothing.

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

#### Scenario: Dismissal uses the reserved slot

- **WHEN** a reviewer dismisses an annotation whose thread holds 49 messages
- **THEN** the reason is appended as the 50th message and the status becomes `Dismissed`

#### Scenario: A full thread cannot be dismissed again

- **WHEN** a reviewer dismisses a reopened annotation whose thread already holds 50 messages
- **THEN** the adapter answers 409 and the lifecycle, thread and events are unchanged
