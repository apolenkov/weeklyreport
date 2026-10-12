# Spec Delta

## MODIFIED Requirements

### Requirement: Feedback access MUST be scoped by method and role

The repository, Agentation adapter, and workbench MUST apply server-derived
ownership, reporting-group, product, and role predicates to every read and
mutation. Leads and viewers MAY read their own rows. Heads MAY read their own
and in-group rows. Admins MAY read all WeeklyReport rows. Only the exact author
MAY edit original content; admins and heads MAY triage visible rows, reply to
visible Agentation threads, and dismiss visible Agentation rows with a reason.
Other visible authenticated authors MAY reply to their own Agentation thread.

The authenticated `/feedback` page and navigation entry MUST remain limited to
the validated inbox-role allowlist, which MUST include `admin` whenever feedback
is enabled. A single-item DELETE for either visible source is admin-only and
confirmation-gated; bulk DELETE commands MUST NOT be exposed or accepted by the
workbench. Stock Agentation DELETE compatibility remains an adapter-only,
non-destructive dismissed transition and MUST NOT remove persisted evidence.

#### Scenario: User scopes and product authority are isolated

- **WHEN** two authenticated users request feedback, threads, actions, or events,
  or a caller supplies another product scope
- **THEN** each receives only records permitted by server-derived scope
- **AND** the product remains `weekly-report`
- **AND** foreign IDs return a non-disclosing not-found/forbidden response

#### Scenario: A lead requests the inbox

- **WHEN** a lead requests WeeklyReport feedback
- **THEN** every returned row is authored by that lead
- **AND** mutation capabilities are derived by the server rather than inferred
  from client role labels

#### Scenario: A head targets another group

- **WHEN** a head requests or mutates feedback outside their group and not
  authored by them
- **THEN** the adapter returns no foreign row or a non-disclosing
  not-found/forbidden response

#### Scenario: A user deletes all visible feedback

- **WHEN** any role requests deletion of multiple feedback rows
- **THEN** no bulk command is available or accepted

#### Scenario: A user deletes feedback

- **WHEN** a non-admin authenticated caller sends DELETE to a workbench
  item
- **THEN** the workbench rejects the command
- **AND** the row, original content, thread, and evidence remain unchanged

#### Scenario: An admin deletes one feedback item

- **WHEN** an admin confirms DELETE for one visible Agentation or legacy item
- **THEN** the targeted item and its associated children are permanently removed
- **AND** Agentation keeps its session while stored annotation events are
  removed and annotation/thread children cascade
- **AND** legacy ProductFeedback annotation children cascade
- **AND** no other feedback row changes
- **AND** the workbench refreshes its current list

#### Scenario: A lead, viewer, or head requests bulk deletion

- **WHEN** a lead, viewer, or head requests bulk deletion through the workbench
- **THEN** no bulk command is available or accepted
- **AND** every feedback row remains unchanged

#### Scenario: An admin deletes all feedback

- **WHEN** an admin requests bulk deletion through the workbench
- **THEN** no bulk command is available or accepted
- **AND** every WeeklyReport feedback row remains unchanged

#### Scenario: The sidebar reloads after deletion

- **WHEN** Agentation or the inbox reloads after an authorized single-item
  DELETE or non-destructive dismissal
- **THEN** the adapter returns non-cacheable current repository state
- **AND** dismissed records remain readable inside their authorized scope

#### Scenario: A user opens the standard sidebar

- **WHEN** an authenticated role opens the Agentation capture surface
- **THEN** it reconnects only to sessions and annotations inside that user's
  server-authorized scope

#### Scenario: A user opens an annotation from the inbox

- **WHEN** an authorized user opens details for an Agentation row
- **THEN** the app shows its normalized page, stored session and annotation
  identifiers, captures, and thread inline
- **AND** the app provides no navigation to the originating page

#### Scenario: A role is not enabled for the extended inbox

- **WHEN** a role is absent from the validated inbox allowlist
- **THEN** the inbox and navigation entry are hidden for that role
- **AND** an otherwise enabled capture surface remains governed by its own
  fail-closed configuration

#### Scenario: Enabled feedback omits the admin inbox

- **WHEN** feedback is enabled but the configured inbox-role allowlist omits
  `admin`
- **THEN** configuration validation fails before serving that inconsistent
  policy

#### Scenario: The MCP agent watches a session

- **WHEN** an authenticated agent opens a session or SSE endpoint
- **THEN** it receives only the permitted initial sync and subsequent events
- **AND** `Last-Event-ID` replay cannot cross the scope boundary

#### Scenario: A reviewer patches original classification fields

- **WHEN** a visible foreign annotation PATCH includes kind, severity or any non-status field, alone or mixed with lifecycle status
- **THEN** only the exact author is admitted and an unauthorized patch changes neither row nor event
- **AND** permitted lifecycle-only updates retain their current role policy

## ADDED Requirements

### Requirement: Agentation SSE settles failed and closed connections

After SSE headers are flushed, startup source failures MUST close an open response without falling back to JSON. Destroyed or ended responses MUST receive no subsequent events or heartbeats. Undelivered events MUST NOT advance the cursor. Startup failure or disconnect MUST create no listener/timer leak, and installed cleanup MUST occur once. Existing numeric envelopes, snapshot sync and replay scope remain unchanged.

#### Scenario: A post-flush read fails

- **WHEN** a startup sequence, deletion, pending or event read rejects after headers flush
- **THEN** startup settles, an open response ends, and no timer or listener remains

#### Scenario: An awaited read completes after disconnect

- **WHEN** the response is destroyed or ended while an initial or live read is pending
- **THEN** no event or sync terminator is written and no undelivered sequence is consumed

### Requirement: Agentation thread timestamp ties have stable order

Every Agentation annotation/thread read MUST order messages by ascending timestamp and then ascending persisted message id, so equal timestamps have the same order in response and event payloads. Stored timestamps and wire representations MUST remain unchanged.

#### Scenario: Two messages share a timestamp

- **WHEN** a thread with equal-timestamp messages is read through annotation, session, synchronization or action boundaries
- **THEN** its messages use the same ascending id tie-breaker
