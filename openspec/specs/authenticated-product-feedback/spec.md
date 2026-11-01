# authenticated-product-feedback Specification

## Purpose

Provide authenticated, role-scoped product feedback through Agentation and a
PostgreSQL-backed adapter, with deterministic inbox detail, preserved legacy
records, and separation from the report review lifecycle. This capability owns
attribution, role-scoped access, rollout and persistence safety; capture, inbox
triage and lifecycle actions live in
[feedback-capture-and-lifecycle](../feedback-capture-and-lifecycle/spec.md), and
the Agentation toolbar, submission confirmation and event stream live in
[agentation-integration](../agentation-integration/spec.md). External onUI tooling
is governed separately by [developer-ui-feedback-tooling](../developer-ui-feedback-tooling/spec.md).

## Requirements

### Requirement: Feedback attribution MUST be server-authoritative

The Agentation-compatible ingress MUST resolve an active WeeklyReport human
session before every browser request and a separately authenticated agent
identity before every MCP mutation or stream. A created or changed feedback
record MUST persist immutable server-derived `authorUserId`, product, role and
group scope. Client-supplied `authorId`, `userId`, project, tenant, name/email,
status, and ownership fields MUST NOT control persistence or authorization.

#### Scenario: An authenticated client spoofs another author

- **WHEN** an annotation or session payload contains another person's identity,
  product, group, project, tenant, or status
- **THEN** the adapter uses the verified session and `weekly-report` scope
- **AND** no spoofed authority is persisted

#### Scenario: A session is missing or barred

- **WHEN** a browser or agent request has no valid permitted identity
- **THEN** the adapter returns 401/403 before reading or mutating feedback rows

#### Scenario: An agent key arrives from a remote address

- **WHEN** a request presents the MCP agent key over a non-loopback socket
- **THEN** the adapter returns 403 before granting agent authority

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

### Requirement: Agentation transport MUST remain behind the feedback module

WeeklyReport MUST pin Agentation 3.0.2 and agentation-mcp 1.2.0 and expose only
the adapter paths required by their published contracts. MCP MUST run with
`--mcp-only --http-url` against the authenticated adapter. The stock Agentation
HTTP server, wildcard CORS, public API-key trust model, and stock SQLite store
MUST NOT be used as the WeeklyReport product backend.

The pinned Agentation component MUST be the only browser surface that
creates new feedback. Feedback about an element, selected text, an empty area,
or the page as a whole MUST use the same Agentation session and same-origin
adapter. WeeklyReport MUST NOT render a separate page-comment form or accept
new legacy `POST /feedback` records. The `/feedback` collection MUST remain
readable as the merged inbox for preserved legacy and Agentation records.

#### Scenario: The widget submits feedback

- **WHEN** the authenticated Agentation widget sends a same-origin payload
- **THEN** the feedback module authenticates and translates it to PostgreSQL
- **AND** callers do not coordinate adapter, session, or persistence details

#### Scenario: A user comments on the page as a whole

- **WHEN** an authenticated user activates Agentation and selects the page or
  an empty page area
- **THEN** Agentation creates a normal annotation in the current session
- **AND** no parallel page-feedback record or second feedback dialog is used

#### Scenario: A client attempts legacy feedback creation

- **WHEN** an authenticated client sends `POST /feedback`
- **THEN** the feedback module rejects the unsupported route without creating a
  legacy row
- **AND** existing legacy rows remain visible through `GET /feedback`

#### Scenario: The widget submits through the adapter

- **WHEN** Agentation sends health, session, annotation, thread, or action
  requests to the same-origin endpoint
- **THEN** the adapter authenticates and translates them to PostgreSQL
- **AND** callers do not coordinate package storage or session details

#### Scenario: MCP starts against WeeklyReport

- **WHEN** MCP is launched with `--mcp-only --http-url` for the adapter
- **THEN** its documented tools work against PostgreSQL-backed resources
- **AND** no stock SQLite file becomes a product source of truth

### Requirement: Feedback creation MUST be concurrency-safe

Annotation creation and synchronization MUST be retry-safe for the same client
identity within the authorized session and author scope. Concurrent requests
MUST NOT create duplicate annotations or disclose another author's row.
Deletion tombstones MUST take precedence over stale creation attempts as
specified by the durable deletion requirement below.

#### Scenario: Two same-author requests race

- **WHEN** two authorized requests synchronize the same annotation identity
  within the same session and author scope
- **THEN** they refer to one persisted annotation without duplicate content
- **AND** a retained deletion tombstone returns terminal state instead of
  recreating the annotation

#### Scenario: Different authors reuse a client id

- **WHEN** two authors use the same client ID in a visible session
- **THEN** the adapter keeps their author scopes separate
- **AND** it does not return another author's record as the caller's retry

### Requirement: Legacy feedback MUST remain manageable within existing rules

The merged inbox MUST continue to display preserved legacy rows. Legacy rows
MUST retain their existing ownership, role, status, and evidence semantics;
Agentation-only operations MUST NOT create a parallel legacy capture path or
grant new authority over old records.

#### Scenario: A reviewer manages a legacy row

- **WHEN** a reviewer opens a preserved legacy row
- **THEN** the UI exposes only actions supported by that row's existing domain
  capability; an admin may explicitly confirm its single-item deletion

### Requirement: Product rollout MUST fail closed

The Agentation widget, inbox, mutations, and SSE MUST be disabled without
explicit validated non-production/development enablement and MUST not be
available in production by accidental default. Feedback operations MUST NOT
mutate report comments, review verdicts, acknowledgements, period state, or
any companion lifecycle field. Existing SitePing rows MUST remain readable and
managed through the preserved domain model.

#### Scenario: Configuration is absent or production

- **WHEN** required enablement or safe-environment configuration is absent, or
  the runtime is production
- **THEN** the product surface and adapter fail closed
- **AND** no stock SQLite fallback is silently enabled

#### Scenario: Configuration is absent or disabled

- **WHEN** validated enablement is absent or disabled
- **THEN** the Agentation widget, inbox, adapter mutations, and SSE are not
  exposed

#### Scenario: A head resolves feedback

- **WHEN** a permitted head resolves or replies to product feedback
- **THEN** only feedback lifecycle/thread evidence changes
- **AND** no report or review record is written

### Requirement: External feedback ingress MUST stay closed pending a separate SSO/token specification

Only the `weekly-report` product is enabled by this contract. The reserved
`external-product` discriminator MUST NOT expose a external product ingress, and the product
MUST NOT add an external feedback-ingress route, until a separate SSO or
short-lived signed-token specification defines one.

#### Scenario: No external ingress route is exposed before its own specification

- **WHEN** the product's feedback surfaces and adapter routes are enumerated
  for any caller or product scope
- **THEN** no `external-product`-scoped or other external feedback-ingress route is
  present
- **AND** none is added by this contract before a separate SSO or short-lived
  signed-token specification defines one

### Requirement: Feedback MUST remain separate from report review lifecycle

Creating, triaging, resolving, or deleting product feedback MUST NOT mutate report comments, review verdicts, acknowledgements, period state, or any companion lifecycle field.

#### Scenario: A head resolves product feedback

- **WHEN** a head changes an allowed feedback row to resolved
- **THEN** only feedback lifecycle and its associated feedback evidence change
- **AND** no report or review record is written

### Requirement: Additive persistence rollout MUST respect the disposable guard

The Prisma schema MUST evolve through a new forward-only migration without
editing applied migration history. Static validation MUST prove that the
migration only adds the Agentation session/annotation structures. Any database
application used for acceptance MUST target an exact disposable database and
MUST NOT reset, seed, or mutate production, shared, or unknown data.

#### Scenario: Schema recreation is verified

- **WHEN** persistence acceptance applies the additive migration to an
  explicitly authorized exact disposable target
- **THEN** the forward-only migration applies without deleting or rewriting
  existing feedback rows
- **AND** the canonical init baseline remains unchanged

### Requirement: Feedback inbox scope is the validated role allowlist

The `/feedback` page and its navigation entry MUST both derive from the same
validated inbox-role allowlist (admin by default). A role outside the allowlist
MUST see the in-page denial wall and MUST NOT see a Feedback navigation entry.
Widening the audience is a deployment configuration change, not a code default.

#### Scenario: A head with the default allowlist

- **WHEN** the allowlist is admin only and a head opens `/feedback`
- **THEN** the denial wall renders and the head's navigation has no Feedback entry
