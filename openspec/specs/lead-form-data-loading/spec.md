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

The data-loading hook MUST preserve the foreign-content purge guard: the
cached cross-author full content MUST be removed whenever the visibility state
leaves Everyone or is not hydrated for the current context, and
unconditionally on any identity change, so one user's foreign records can
never be served to another identity from the query cache.

#### Scenario: leaving Everyone purges cached foreign content

- **WHEN** the record-visibility toggle moves from Everyone to Mine
- **THEN** the cached cross-author full-content query is removed
- **AND** a later return to Everyone re-fetches instead of serving stale rows

#### Scenario: identity change purges cached foreign content

- **WHEN** the signed-in user id or session role changes
- **THEN** the cached cross-author full-content query is removed
  unconditionally

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
