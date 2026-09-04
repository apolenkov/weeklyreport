## MODIFIED Requirements

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

The repository and adapter MUST apply the existing ownership/group/admin
predicates to sessions, annotations, pending queries, statuses, threads,
actions, and SSE. No user, product, or group may observe or mutate another
scope through either the UI or MCP tools. The role-aware `/feedback` inbox and
the authenticated creation surface remain available only under validated
configuration and existing role policy.

#### Scenario: User scopes and product authority are isolated

- **WHEN** two authenticated users request sessions, pending records, threads,
  actions, or events, or a caller supplies another product scope
- **THEN** each receives only records permitted by its server-derived scope
- **AND** the product remains `weekly-report`
- **AND** foreign IDs return a non-disclosing not-found/forbidden response

#### Scenario: A lead requests the inbox

- **WHEN** a lead requests WeeklyReport feedback
- **THEN** every returned row is inside that lead's server-authorized scope

#### Scenario: A head targets another group

- **WHEN** a head requests or patches feedback outside their group and not
  authored by them
- **THEN** the adapter returns no foreign row or a non-disclosing
  not-found/forbidden response

#### Scenario: A user deletes feedback

- **WHEN** an active user requests a delete-compatible transition for their own
  row
- **THEN** the row remains preserved and its allowed lifecycle status changes
- **AND** a foreign row is not disclosed

#### Scenario: A user deletes all visible feedback

- **WHEN** a lead, viewer, or head requests bulk deletion
- **THEN** only rows owned by that user receive the non-destructive transition

#### Scenario: An admin deletes all feedback

- **WHEN** an admin requests bulk deletion
- **THEN** all WeeklyReport rows receive the configured non-destructive transition

#### Scenario: The sidebar reloads after deletion

- **WHEN** the Agentation UI reloads a mutable feedback query
- **THEN** the adapter returns non-cacheable current repository state

#### Scenario: A user opens the standard sidebar

- **WHEN** an authenticated role opens the Agentation message panel
- **THEN** the panel opens in place with only authorized records

#### Scenario: A user opens an annotation from the inbox

- **WHEN** an authorized user selects an annotated inbox item
- **THEN** the app navigates to its normalized page, reconnects the stored
  Agentation session, and preserves the annotation identifier in the URL
- **AND** exact annotation autofocus is not claimed while the pinned stock
  component exposes no supported focus API

#### Scenario: A role is not enabled for the extended inbox

- **WHEN** a role is absent from the validated inbox allowlist
- **THEN** the inbox and navigation entry are hidden while the enabled capture
  surface remains fail-closed according to rollout configuration

#### Scenario: The MCP agent watches a session

- **WHEN** an authenticated agent opens the session or global SSE endpoint
- **THEN** it receives only the permitted initial sync and subsequent events
- **AND** `Last-Event-ID` replay cannot cross the scope boundary

### Requirement: Agentation transport MUST remain behind the feedback module

WeeklyReport MUST pin Agentation 3.0.2 and agentation-mcp 1.2.0 and expose only
the adapter paths required by their published contracts. MCP MUST run with
`--mcp-only --http-url` against the authenticated adapter. The stock Agentation
HTTP server, wildcard CORS, public API-key trust model, and stock SQLite store
MUST NOT be used as the WeeklyReport product backend.

#### Scenario: The widget submits feedback

- **WHEN** the authenticated Agentation widget sends a same-origin payload
- **THEN** the feedback module authenticates and translates it to PostgreSQL
- **AND** callers do not coordinate adapter, session, or persistence details

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

#### Scenario: SitePing opens its drawing instruction surface

- **WHEN** the old SitePing surface is encountered during migration
- **THEN** it is not used for new product traffic and no private SitePing DOM
  shim is required

#### Scenario: A reviewer deletes an annotation

- **WHEN** an authorized UI or MCP caller sends DELETE for an annotation
- **THEN** the adapter records the configured resolved/dismissed transition
- **AND** the feedback row, legacy row, thread, and captured evidence remain

#### Scenario: The adapter emits an event

- **WHEN** a permitted create, update, delete-compatible transition, thread, or
  action occurs
- **THEN** it emits the documented event name and JSON payload with sequence ID
- **AND** reconnecting with `Last-Event-ID` receives the missing events only

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
