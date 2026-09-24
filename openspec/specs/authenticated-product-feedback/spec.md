# authenticated-product-feedback Specification

## Purpose

Provide authenticated, role-scoped product feedback through Agentation and a
PostgreSQL-backed adapter, with deterministic inbox detail, preserved legacy
records, and separation from the report review lifecycle. External onUI tooling
is governed separately by [developer-ui-feedback-tooling](../../changes/standardize-onui-ui-review/specs/developer-ui-feedback-tooling/spec.md).

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
- **AND** the composer remains fully inside the viewport

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

### Requirement: Legacy feedback MUST remain manageable within existing rules

The merged inbox MUST continue to display preserved legacy rows. Legacy rows
MUST retain their existing ownership, role, status, and evidence semantics;
Agentation-only operations MUST NOT create a parallel legacy capture path or
grant new authority over old records.

#### Scenario: A reviewer manages a legacy row

- **WHEN** a reviewer opens a preserved legacy row
- **THEN** the UI exposes only actions supported by that row's existing domain
  capability; an admin may explicitly confirm its single-item deletion

### Requirement: Canonical feedback context MUST survive report redirects

Canonical report redirects MUST preserve the supported legacy `feedback` and
`feedbackUrl` parameters and Agentation `agentationSession` and
`agentationAnnotation` parameters without expanding authorization scope.
This URL continuity MUST NOT introduce navigation controls in the feedback
workbench. Exact annotation autofocus is not part of the contract while the
stock widget has no supported focus API. The retired SitePing auto-scroll and
highlight behavior MUST NOT be restored, and no replacement focus mechanism is
introduced.

#### Scenario: A report route redirects to its canonical URL

- **WHEN** a URL with supported feedback context enters through a non-canonical
  lead or head report route
- **THEN** the canonical destination retains the supplied supported parameters
- **AND** ordinary feedback authorization still applies

#### Scenario: A link targets a record outside the default newest page

- **WHEN** an authorized caller follows a supported inbound feedback link
  targeting a record that is not within the default newest page
- **THEN** the initial URL-scoped list includes that record within the
  caller's existing server-derived authorization scope
- **AND** an inaccessible or missing target is not included, and its
  existence is not disclosed by a different response

### Requirement: Agentation integration MUST prefer supported upstream mechanisms

WeeklyReport MUST use the public Agentation widget and MCP client. Until public
upstream identity and popup-placement fixes exist, pinned Agentation 3.0.2 MUST
carry only the reviewed patch that:

- adds optional `clientId` to `Annotation` and preserves the original local ID
  there when live synchronization replaces it with a different server ID; and
- measures and clamps the package-owned contextual popup to 8 px viewport
  gutters using its final unscaled box, remeasures it after size or viewport
  changes, and keeps its actions outside the scrollable content region.

That patch MUST NOT change Agentation's transport, endpoint, payload, callback
order, identity authority, or storage ownership. Custom protocol behavior MUST
be limited to requirements not met by supported upstream mechanisms and MUST
have a documented reason and an executable check. The integration MUST NOT
import package internals, apply dependency patches beyond these two repairs, or
replace PostgreSQL or server-authoritative identity merely to remove adapter
code.

#### Scenario: A dependency upgrade changes its wire behavior

- **WHEN** the installed Agentation or MCP dependency is updated
- **THEN** public type and executable consumer contracts verify the adapter
- **AND** compatibility MUST NOT depend on formatting of a compiled bundle
- **AND** an incompatible result blocks acceptance rather than changing access or deletion semantics silently

#### Scenario: A supported upstream mechanism can replace custom code

- **WHEN** source-bound comparison proves that a public upstream mechanism satisfies the same requirement
- **THEN** the integration uses that mechanism without keeping a parallel implementation

#### Scenario: Upstream lacks a required extension point

- **WHEN** stock behavior cannot preserve required storage, attribution, access, or deletion semantics
- **THEN** the adapter retains that boundary with its requirement, source evidence, and test
- **AND** a change to those requirements requires explicit user approval

#### Scenario: A cached browser page returns after administrative deletion

- **WHEN** an administrator deletes an annotation while its author's page is away
- **AND** the browser restores the cached page through back or forward navigation
- **THEN** the public widget starts a fresh server synchronization
- **AND** a deleted annotation does not remain as a stale marker or recreate server content

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
`core-dev` discriminator MUST NOT expose a CoreDev ingress, and the product
MUST NOT add an external feedback-ingress route, until a separate SSO or
short-lived signed-token specification defines one.

#### Scenario: No external ingress route is exposed before its own specification

- **WHEN** the product's feedback surfaces and adapter routes are enumerated
  for any caller or product scope
- **THEN** no `core-dev`-scoped or other external feedback-ingress route is
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

### Requirement: Contextual feedback composition MUST remain operable inside the viewport

The pinned Agentation widget MUST retain drawn annotations, right-click comments,
screenshot capture, console/network diagnostics, and marker visibility. Its
contextual popup MUST calculate placement from its rendered dimensions rather
than a smaller fixed estimate, and MUST remain bounded by the current viewport
so its explicit Add and Cancel actions are reachable. WeeklyReport application
code MUST NOT query, move, resize, or style Agentation's private injected DOM.

#### Scenario: A tall region leaves insufficient space above and below

- **WHEN** an authenticated user draws a region that occupies most of a 1728x962 viewport
- **THEN** the popup is clamped inside the viewport using its rendered height and width
- **AND** an enabled explicit Add button is visible and clickable
- **AND** keyboard submission remains a secondary accelerator rather than the only visible path

#### Scenario: The popup renders in a narrow or short viewport

- **WHEN** popup content approaches the available viewport dimensions
- **THEN** the popup box remains within 8 px viewport gutters and its actions remain reachable
- **AND** the underlying document does not gain horizontal overflow

#### Scenario: WeeklyReport initializes contextual feedback

- **WHEN** the application mounts the Agentation widget
- **THEN** it configures only the package's supported public API
- **AND** the package-owned popup performs its own measured placement

### Requirement: Agentation submission confirmation MUST remain visible and retryable

When an authenticated user creates an Agentation annotation, WeeklyReport MUST
retain Agentation's native optimistic annotation and exact comment while it
confirms persistence through the authorized session response. If confirmation
does not arrive within a bounded attempt window, the application MUST render a
persistent `role="alert"` with the literal message `Could not confirm that
feedback was saved. Your annotation is still here.` and a `Retry` action.

When the session ID is known, Retry MUST preserve the native annotation and MUST
reuse Agentation's retained original client ID and own session through a
supported native remount. The application MUST NOT remount retry while the
session is unknown, intercept global browser transport, send a parallel custom
annotation create, or infer success from the optimistic marker. Confirmation
MUST match the original client ID, requested session ID, and current
server-session author ID in the authorized session response. An authenticated
actor, page, session, or annotation change MUST cancel the former confirmation
observer, and an older observer MUST NOT clear a newer error. Retry MUST keep
the alert visible until confirmation. If the user deletes or clears the retained
native annotation, its delivery alert MUST be removed.

The retained native annotation MUST preserve its original client ID exactly
when live synchronization adopts a different server ID. Delete and clear
callbacks MUST remove delivery state only when the callback annotation's `id`
or preserved `clientId` equals the current candidate's original client ID. This
cleanup MUST remain local and MUST NOT depend on a later confirmation GET.

#### Scenario: Persistence cannot be confirmed

- **WHEN** the native annotation POST fails, its response is slow, or authorized
  session readback remains unavailable through the bounded confirmation window
- **THEN** the native optimistic marker and exact comment remain owned by
  Agentation
- **AND** WeeklyReport shows the persistent honest alert and `Retry` action
- **AND** the page does not claim that the annotation was saved or lost

#### Scenario: The user retries an unconfirmed annotation

- **WHEN** the user activates `Retry`
- **THEN** WeeklyReport remounts the native widget so Agentation can
  retry its retained annotation with the original client ID and known session
- **AND** the honest alert remains visible while confirmation is retried
- **AND** no application-owned annotation POST is sent
- **AND** retry-safe persistence creates at most one annotation for the known
  session, server-session author, and client-ID tuple

#### Scenario: Persistence is confirmed

- **WHEN** authorized session readback contains the original annotation client ID
- **THEN** WeeklyReport removes the unconfirmed alert
- **AND** Agentation remains responsible for its native server-ID reconciliation

#### Scenario: Observation scope changes

- **WHEN** the page, session, annotation, or component lifetime changes during
  confirmation
- **THEN** the former observer is aborted
- **AND** it cannot clear or replace the current annotation's delivery state

#### Scenario: The retained annotation is removed

- **WHEN** Agentation reports that the user deleted the unconfirmed annotation
  or cleared a collection containing it by its original ID, or by a server ID
  paired with its preserved original `clientId`
- **THEN** WeeklyReport cancels its observer and removes the associated alert
- **AND** cleanup succeeds when confirmation readback remains unavailable

#### Scenario: An older synchronized annotation is removed

- **WHEN** a delete or clear callback identifies an older annotation after a
  newer delivery candidate is current
- **THEN** the newer candidate, observer, and alert remain unchanged
