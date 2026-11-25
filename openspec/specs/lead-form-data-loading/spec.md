# lead-form-data-loading Specification

## Purpose

Defines the lead form's extracted data-loading hook boundary: which queries,
enablement chains, record-visibility gating, cache purges, and redirects it
owns, and the behavior it must preserve for the lead report form.

## Requirements

### Requirement: Lead form data loading is isolated behind a tested hook boundary

The lead report form at `/lead/report/[reportId]` MUST keep its data-loading
layer — the active-report, by-period, history, view-settings, cross-author, and
cross-author-content queries, their enablement chains, record-visibility
gating, foreign-content cache purges, canonical/head-away redirects, and query
error handlers — behind a feature-local tested hook. The hook MUST NOT
introduce new API procedures, schemas, routes, product UI strings, or write
endpoints, MUST NOT be imported by head or viewer surfaces, and MUST NOT
absorb the draft-orchestration, write-action, or draft-merge boundaries.

#### Scenario: LeadForm delegates data loading

- **WHEN** the lead report form renders
- **THEN** `LeadForm` obtains query data, gating flags, visibility state and
  setters, and loading state from the data-loading hook
- **AND** fullscreen ownership, draft orchestration, write actions, draft
  merges, and loaded view-model consumption remain outside that boundary

### Requirement: Query enablement chains preserve current loading behavior

The data-loading hook MUST preserve the current query enablement semantics.
The by-period read MUST fire only when a target report is known, the session
is not loading, and the session is not a head-like role. The cross-author
full-content read MUST fire only when a target report is known, the persisted
record-visibility state has hydrated, Everyone is selected, and the deck is
the user's own.

#### Scenario: byPeriod waits for its gate

- **WHEN** no target report id is resolved yet, the session is still loading,
  or the session role is head-like
- **THEN** the by-period query issues no request

#### Scenario: full content read stays gated

- **WHEN** visibility is not hydrated, Mine is selected, or the slides deck is
  a foreign author's deck
- **THEN** the cross-author full-content query issues no request

### Requirement: Foreign-content cache purges preserve current isolation

The lead data-loading hook MUST isolate cross-author full content by the trusted current user id and session role before display. It MUST remove obsolete, legacy and unattributed scopes on mount and identity change while preserving pending and warm reads belonging to the exact trusted current viewer. Without a trusted viewer, or outside hydrated Everyone, it MUST expose no full content and MUST purge the sensitive procedure prefix. Scope metadata MUST NOT become server request input or authorization.

#### Scenario: leaving Everyone purges cached foreign content

- **WHEN** the record-visibility toggle moves from Everyone to Mine
- **THEN** the cached cross-author full-content query is removed
- **AND** a later return to Everyone re-fetches instead of serving stale rows

#### Scenario: identity change purges cached foreign content

- **WHEN** the signed-in user id or session role changes
- **THEN** the cached cross-author full-content query is removed
  unconditionally

#### Scenario: Another viewer becomes current while Everyone remains selected

- **WHEN** auth.me changes identity while the same QueryClient/report is mounted
- **THEN** every committed current-viewer projection excludes previous-viewer content
- **AND** the current viewer's pending response can settle without an extra refetch

### Requirement: Route redirects preserve current navigation behavior

The data-loading hook MUST preserve the current redirect semantics: on the
bare lead-report route the form MUST replace the URL with the canonical
addressed form once the active report id is known, and a head-like session
MUST be routed away from the lead form to its own surface.

#### Scenario: bare route becomes canonical

- **WHEN** the form renders on the bare route with redirect-to-canonical
  enabled and the active report id resolves
- **THEN** the router replaces the URL with the addressed
  `/lead/report/<reportId>` form, preserving slides mode

#### Scenario: head-like session is routed away

- **WHEN** the session role is head or admin
- **THEN** the router replaces the location with the head report or dashboard
  surface

### Requirement: Relocated presentational modules render identically

The lead-form SVG icon components and the record-visibility toggle MUST render
byte-identical markup from their own modules: decorative icons keep
`aria-hidden`, and the toggle keeps its accessible names, pressed states, and
disabled behavior on foreign slide decks.

#### Scenario: relocation does not change rendered markup

- **WHEN** the lead form renders after the relocation
- **THEN** the existing icon accessibility and record-visibility toggle tests
  pass unchanged

### Requirement: Lead form exposes terminal section-load recovery

The lead report form at `/lead/report/[reportId]` MUST replace its loading
skeleton with a visible terminal error state when `leadForm.byPeriod` fails.
The state MUST explain that the report could not be loaded, MUST expose a
`Retry` action, and MUST NOT render stale editable draft content while the
failed query remains in an error state. The existing centralized client-error
policy MUST continue to report the failure.

#### Scenario: Primary section read fails

- **WHEN** `leadForm.byPeriod` reaches a terminal error for the addressed report
- **THEN** the lead form shows a visible load-failure title and recovery guidance
- **AND** it shows a `Retry` action instead of a perpetual loading skeleton
- **AND** no editable draft controls or stale report records are rendered

#### Scenario: Retry recovers the lead form

- **WHEN** a lead activates `Retry` and the next `leadForm.byPeriod` request
  succeeds
- **THEN** the terminal error state is replaced by the loaded lead form
- **AND** the form is derived from the successful response

#### Scenario: Retry remains failed

- **WHEN** a lead activates `Retry` and `leadForm.byPeriod` fails again
- **THEN** the terminal error state remains visible
- **AND** the `Retry` action remains available after the request settles

### Requirement: Required Lead reads expose recoverable terminal outcomes

The Lead form MUST distinguish pending reads from settled failures of the active
period, by-period section, personal history, view settings and cross-author
reads. The view-settings and cross-author reads MUST NOT start before the section
fetch is enabled. A required-read failure MUST show persistent recovery without
exposing stale editable controls. Retry MUST request the failed required reads
and MUST NOT refetch successful independent reads. Repeated Retry while its
request is pending MUST reuse that operation. A retry for an earlier report MUST
NOT change the recovery state of the current report.

#### Scenario: A supporting required read fails

- **GIVEN** the active-period or personal-history query fails
- **WHEN** the error settles
- **THEN** the Lead editor replaces its loading skeleton with persistent Retry
- **AND** the existing centralized error reporting records the failure

#### Scenario: A supporting read recovers after Retry

- **GIVEN** a required read is in error
- **WHEN** the lead retries
- **THEN** recovery remains visible and Retry is disabled while the request runs
- **AND** success reveals the current matching draft, or another failure leaves Retry available

#### Scenario: Navigation occurs during a retry

- **GIVEN** report A has a pending retry
- **WHEN** the lead navigates to report B and A's request later settles
- **THEN** B's read and recovery state is unaffected by A's completion

#### Scenario: A companion read fails

- **GIVEN** the view-settings or cross-author query fails after the section loaded
- **WHEN** the error settles
- **THEN** the Lead editor shows the shared load error with Retry instead of default view settings or an empty cross-author list

### Requirement: Missing active periods are terminal empty results

A successful active-period read returning null MUST show that no active reporting
period is available in edit, slides and Overview. It MUST NOT remain a loading
skeleton or fabricate active data from a cached draft. An active-query failure
MUST NOT be presented as the same empty result.

#### Scenario: The active read succeeds without an active period

- **WHEN** the active-period read returns null
- **THEN** the Lead page displays a no-active-period state without error telemetry
- **AND** no editable draft is shown in edit or slides

### Requirement: Overview exposes editor read recovery independently

An available Overview MUST remain readable when a required editor read fails.
Its editing controls MUST stay unavailable and it MUST expose a Retry action for
the failed editor reads. Failure to resolve the active period without a target
MUST show load recovery instead of the no-active-period message.

#### Scenario: History fails while Overview is available

- **GIVEN** the Overview query succeeds but personal history fails
- **WHEN** Overview renders
- **THEN** its content remains read-only with a Retry for editor loading
- **AND** recovery of history restores editing when the other editor inputs are ready

### Requirement: Role-away suspension preserves local edit recognition

The lead editor MUST suspend unsent autosave while a head/admin redirect is pending. Payload/baseline inequality and local-only rows MUST still identify unsaved content for server reseed independently of writer enablement. Exact own-save echoes MUST reconcile identities without dropping newer fields; genuine external changes MUST retain existing conflict/refetch/announcement/adoption behavior.

#### Scenario: A delayed read arrives during role-away

- **WHEN** unsaved Lead input exists and the session becomes head/admin before a delayed read settles
- **THEN** no newly issued draft save occurs during suspension
- **AND** same-payload refresh or exact own-save echo preserves newer local input

### Requirement: Missing section retains supporting recovery

When section NOT_FOUND coexists with failed active/history reads, the Lead editor MUST expose persistent scoped Retry for only those failed supporting reads. Successful supporting recovery MUST return to unavailable while the section remains missing. Normal no-active precedence and expected NOT_FOUND notifications remain unchanged.

#### Scenario: Required history fails while section is missing

- **WHEN** section is unavailable and history fails
- **THEN** Retry requests history only, coalesces pending retries and remains available on failure
- **AND** successful history recovery returns to the unavailable section state
