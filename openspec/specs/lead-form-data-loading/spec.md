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

### Requirement: Query enablement chains remain behavior-compatible

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

### Requirement: Foreign-content cache purges remain behavior-compatible

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

### Requirement: Route redirects remain behavior-compatible

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
