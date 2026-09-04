## ADDED Requirements

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

### Requirement: Feedback deletion MUST be explicit and admin-only

The workbench MUST expose a `Delete` action only for one visible item from
either source when the server grants the admin capability. Delete MUST target
exactly one item, require an explicit confirmation, and permanently remove the
selected item and its associated children. Agentation deletion MUST keep the
session while stored annotation events are removed explicitly and
annotation/thread children cascade; legacy ProductFeedback deletion MUST
cascade annotation children. Delete MUST NOT be available to non-admin roles or
as a bulk operation.

#### Scenario: An admin deletes one feedback item

- **WHEN** an admin confirms deletion of one visible Agentation or legacy item
- **THEN** only that item is permanently removed
- **AND** Agentation keeps its session while stored annotation events are
  removed and annotation/thread children cascade
- **AND** legacy ProductFeedback annotation children cascade
- **AND** the workbench refreshes its current list without affecting other rows

#### Scenario: A non-admin requests deletion

- **WHEN** a non-admin requests deletion of a visible item
- **THEN** the adapter rejects the command without changing the row

#### Scenario: An admin attempts bulk deletion

- **WHEN** an admin requests deletion of multiple feedback items
- **THEN** no bulk command is available or accepted

### Requirement: Legacy feedback MUST remain manageable within existing rules

The merged inbox MUST continue to display preserved legacy rows. Legacy rows
MUST retain their existing ownership, role, status, and evidence semantics;
Agentation-only operations MUST NOT create a parallel legacy capture path or
grant new authority over old records.

#### Scenario: A reviewer manages a legacy row

- **WHEN** a reviewer opens a preserved legacy row
- **THEN** the UI exposes only actions supported by that row's existing domain
  capability; an admin may explicitly confirm its single-item deletion

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
