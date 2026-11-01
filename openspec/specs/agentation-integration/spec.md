# agentation-integration Specification

## Purpose

Defines how the Agentation toolbar, submission confirmation, event stream and thread ordering behave over the PostgreSQL-backed feedback adapter.

## Requirements

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

WeeklyReport MUST use the public, unmodified Agentation widget and MCP client. The React feedback surface MUST treat popup placement, local annotation identifiers, and other package-owned presentation details as upstream behavior rather than rewriting the distributed package.

Custom protocol behavior MUST be limited to requirements not met by supported upstream mechanisms and MUST have a documented reason and an executable check. The integration MUST NOT import package internals, apply dependency patches, or replace PostgreSQL or server-authoritative identity merely to alter package-owned presentation behavior.

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
- **AND** package-owned presentation behavior without a supported extension point remains stock and unpatched

#### Scenario: A cached browser page returns after administrative deletion

- **WHEN** an administrator deletes an annotation while its author's page is away
- **AND** the browser restores the cached page through back or forward navigation
- **THEN** the public widget starts a fresh server synchronization
- **AND** a deleted annotation does not remain as a stale marker or recreate server content

### Requirement: The Agentation toolbar MUST be development-only

The Agentation browser toolbar code MUST be excluded from production builds and MUST NOT render or load when the runtime is production, regardless of feedback enablement variables.

#### Scenario: Production runtime

- **WHEN** `NODE_ENV` is `production` and feedback enablement is `true`
- **THEN** the widget renders nothing and the `agentation` module is not imported

### Requirement: Contextual feedback composition MUST use stock package placement

The pinned Agentation widget MUST retain drawn annotations, right-click comments,
screenshot capture, console/network diagnostics, and marker visibility.
Contextual popup placement is package-owned stock behavior; WeeklyReport
application code MUST NOT query, move, resize, or style Agentation's private
injected DOM and MUST NOT carry a local patch or wrapper to alter it.

#### Scenario: WeeklyReport initializes contextual feedback

- **WHEN** the application mounts the Agentation widget
- **THEN** it configures only the package's supported public API
- **AND** popup placement is whatever the unmodified package provides

#### Scenario: Stock placement renders poorly at a viewport edge

- **WHEN** the unmodified package positions the composer outside its intended
  bounds
- **THEN** the defect is owned and fixed upstream
- **AND** WeeklyReport does not compensate with a patch or first-party rewrite

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
native annotation while the public callback still identifies it by its captured
client-local ID, its delivery alert MUST be removed.

Stock Agentation replaces a synchronized annotation's client-local ID with its
server ID and does not expose the original ID again through public callbacks.
Delete and clear callbacks MUST remove delivery state only when the callback
annotation's `id` equals the current candidate's captured client-local ID. Once
the widget has adopted a server ID, its delete and clear callbacks can no longer
identify the retained annotation, so the delivery state and alert persist; they
clear only when a `Retry`-driven confirmation succeeds or the observation scope
changes. This cleanup MUST remain local and MUST NOT depend on a later
confirmation GET.

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
  or cleared a collection containing it while it still carries its original
  client ID
- **THEN** WeeklyReport cancels its observer and removes the associated alert
- **AND** cleanup succeeds when confirmation readback remains unavailable

#### Scenario: An adopted annotation is removed before confirmation

- **WHEN** the stock widget has replaced the retained annotation's client-local
  ID with its server ID and the user deletes or clears it before delivery is
  confirmed
- **THEN** the public callback carries only the adopted server ID
- **AND** the pending delivery state cannot be matched to it, so the honest
  alert remains until a `Retry`-driven confirmation succeeds or the
  observation scope changes

#### Scenario: An older synchronized annotation is removed

- **WHEN** a delete or clear callback identifies an older annotation after a
  newer delivery candidate is current
- **THEN** the newer candidate, observer, and alert remain unchanged

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

### Requirement: A session snapshot MUST list annotations in a stable order

The session snapshot (`GET /sessions/:id`) MUST order a session's annotations
by capture timestamp and then by server ID, so annotations that share a capture
timestamp appear in the same order on every read.

#### Scenario: annotations share a capture timestamp

- **WHEN** several annotations in one session carry the same capture timestamp
- **THEN** the snapshot lists them in ascending server-ID order
- **AND** repeated reads return the same order

#### Scenario: annotations have distinct capture timestamps

- **WHEN** annotations carry different capture timestamps
- **THEN** the snapshot lists them in ascending timestamp order

### Requirement: The feedback inbox MUST order a thread like the session snapshot

Every inbox projection of an annotation thread, in the list and in the
responses of edit, status and dismiss actions, MUST order thread messages by
timestamp and then by server ID, the same order as the session snapshot.

#### Scenario: replies share a millisecond

- **WHEN** several replies on one annotation carry the same timestamp
- **THEN** the inbox lists them in the same order as the session snapshot
- **AND** that order is ascending by server ID

#### Scenario: replies carry different timestamps

- **WHEN** replies carry different timestamps
- **THEN** the inbox lists them in ascending timestamp order, regardless of
  insertion order
