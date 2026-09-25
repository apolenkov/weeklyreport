# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Contextual feedback composition MUST remain operable inside the viewport

**Reason**: Popup placement is package-owned stock behavior; the locally patched
measured placement is removed and WeeklyReport no longer guarantees
viewport-bounded popup geometry.

**Migration**: Replaced by "Contextual feedback composition MUST use stock
package placement"; viewport defects are reported upstream.
