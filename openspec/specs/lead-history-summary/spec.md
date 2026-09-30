# lead-history-summary Specification

## Purpose

Present lead report history in period order with completed-period-only aggregates, matching denominators, and direct history navigation.

## Requirements

### Requirement: History list is ordered by reporting-period chronology

The lead history list MUST order entries by reporting-period chronology,
newest period first (`report.periodStart` descending), NOT by the report
section row's creation time. The order MUST match the compiled-history
order used for the head/viewer view so both reads of the same surface
agree. A stable secondary tiebreak MUST be applied so entries that share
a period boundary keep a deterministic order.

#### Scenario: Lead opens history and the latest period is on top

- **WHEN** a lead opens `/reports` and the list renders multiple periods
- **THEN** the entry for the most recent reporting period appears first
- **AND** entries descend by reporting-period date, regardless of when
  each section row was created

#### Scenario: Summary streak reads the same order as the list

- **WHEN** the summary rail computes the "submitted N weeks in a row"
  streak from the top of the list
- **THEN** it counts down the same newest-period-first order the list
  shows, so the streak reflects the most recent consecutive submissions

### Requirement: History summary aggregates count only completed periods

The lead history summary rail MUST compute its aggregate figures — the
traffic-light totals, average items, and total risks — only from
completed periods (a period submitted by the lead, or published, or
archived). A draft period is provisional and MUST be excluded from these
aggregates, as is a reopened period. The exclusion MUST be disclosed in
neutral plain text beside the figures (e.g. "N week not included in
aggregates") whenever at least one period is excluded.

#### Scenario: A draft period does not inflate the aggregates

- **WHEN** a lead has completed periods plus one draft period
- **THEN** the traffic-light totals, average items, and total risks count
  only the completed periods
- **AND** a note discloses that the excluded week is not included

### Requirement: Aggregate footer denominator matches what it counts

The summary rail's traffic-light footer MUST state a period count that
matches the periods actually aggregated. Because the aggregates count
only completed periods, the footer's "across N periods" denominator MUST
be the count of completed periods, NOT the full history total — so the
numerator (the traffic-light sums) and the denominator describe the same
set.

#### Scenario: Footer denominator agrees with the counted lights

- **WHEN** a lead has 3 periods of which 2 are completed and 1 is a draft
- **THEN** the traffic-light footer reads "across 2 periods" (the
  completed set), not "across 3 periods"
- **AND** the separate draft note still discloses the excluded draft

### Requirement: History traffic-light totals match the report's effective status

Each personal history entry's traffic-light totals MUST count every owned
product by the same effective status the report shows for it, including the
floor from covering risks (a Blocked risk covering a product's stage makes
that product red even when its stored status is green). Totals MUST NOT be
counted from the raw stored product status rows.

#### Scenario: A blocked risk turns the card red

- **WHEN** a live section's product has a stored green status and a Blocked
  risk covering one of its owned stages
- **THEN** the history card counts that product as red, not green

### Requirement: The reports history page carries no tab state

The `/reports` history page MUST render a single role-defaulted history
view at `/reports` and MUST NOT depend on a `tab` query parameter. The page
MUST NOT carry copy or comments promising tabs that are not implemented.

#### Scenario: Lead opens the unified history page

- **WHEN** a lead navigates to `/reports`
- **THEN** the lead sees the role-defaulted personal history
- **AND** no tab affordance or tab query parameter is present

### Requirement: History navigation links carry no tab parameter

The NavBar History link MUST target `/reports` with no `tab` query parameter
for every role that sees it (lead, head, viewer). Neither the page nor the links
that reach it depend on a tab state.

#### Scenario: the History nav link omits the tab param

- **WHEN** the NavBar renders the History link for a lead, head, or viewer
- **THEN** the link's href is `/reports` with no `tab` query parameter

### Requirement: Compiled history does not invent lead submission state

The reports-history React route MUST NOT render `Submitted: Not submitted` for a compiled published or archived entry when the compiled history contract has no lead-specific submission timestamp. Lead-specific draft history MAY retain the explicit not-submitted state.

#### Scenario: Published compiled card is rendered

- **WHEN** a published compiled history entry has publication metadata but no lead submission timestamp
- **THEN** the card shows its published state and MUST NOT show `Not submitted`

#### Scenario: Draft lead card lacks a timestamp

- **WHEN** a lead-specific draft entry has no submission timestamp
- **THEN** the card continues to show `Not submitted`

### Requirement: Compiled history uses the immutable publication snapshot

The compiled history query MUST derive section-scoped counts, traffic-light
totals, and product totals from the report's validated `publishedSnapshot`.
It MUST NOT read mutable items, risks, decisions, or status rows from the
published report graph. A missing, malformed, report-mismatched, or
scope-mismatched closed-publication snapshot MUST fail closed rather than
serving a live graph projection. When a period is reopened, newly created live
sections are not part of the last publication and MUST be ignored until the
next publish replaces the snapshot.

#### Scenario: Later edits do not change a compiled history entry

- **WHEN** a published report's live records or product statuses change after
  publication
- **THEN** compiled history continues to show the counts and totals frozen in
  the publication snapshot

#### Scenario: Invalid snapshot is rejected

- **WHEN** a published report has no valid snapshot for the requested scoped
  sections
- **THEN** the compiled history read fails closed
- **AND** it does not fall back to mutable report records

#### Scenario: Reopened edits do not corrupt the last published entry

- **GIVEN** a reopened report has a new live section that was not present in
  its last publication snapshot
- **WHEN** a head or lead reads compiled history
- **THEN** the entry is derived from the last published scoped sections only
- **AND** the new live section appears only after the report is published again

#### Scenario: A reopened period is not presented as currently published

- **GIVEN** a published report has been reopened and is live again
- **WHEN** a head reads compiled history
- **THEN** the entry carries `reopened: true` and the card shows a Reopened badge instead of Published
- **AND** its publication time is labelled as the last publication
- **AND** the entry does not count toward the published aggregates or streak

### Requirement: Personal history uses the immutable publication snapshot

The lead-specific history read MUST derive entries for published periods from
the validated `publishedSnapshot`, including section status and record counts.
It MUST NOT load mutable sections, items, risks, decisions, or status rows for a
published period. The database candidate query MUST admit only
`periodStatus = published` reports through the indexed frozen author scope;
reopened reports are admitted exactly once through their live section path.
Draft and reopened live periods MAY use their current rows.

#### Scenario: Published personal history survives live-row mutation

- **WHEN** a lead's published section or child records are changed or removed
  after publication
- **THEN** the lead's history entry retains the published section status and
  record counts from the immutable publication snapshot
- **AND** later edits to the mutable report graph do not alter that history entry

### Requirement: Personal history is explicitly cursor-paginated

The `reports.myHistory` contract MUST accept an optional opaque cursor and an
explicit bounded `limit` (maximum 100), and MUST return `items` plus
`nextCursor`. The repository MUST fetch at most `limit + 1` live sections and
published report envelopes per source, merge them by period chronology with a
stable id tie-breaker, and use the probe row to determine whether another page
exists. It MUST NOT load the complete live graph or complete published-report
set for an author. A malformed cursor MUST fail with a client error rather
than restarting at the first page.

#### Scenario: Older personal history remains reachable

- **WHEN** a lead requests a page with a limit smaller than their history
- **THEN** the response contains at most that limit and a non-null `nextCursor`
  when more entries exist
- **AND** requesting that cursor returns the following entries without
  duplicating the previous page

#### Scenario: Pagination terminates explicitly

- **WHEN** the final page is returned
- **THEN** `nextCursor` is `null`, and the API never silently truncates history
- **AND** the query does not fall back to the mutable published graph

#### Scenario: Personal history uses one repeatable-read snapshot

- **WHEN** a report is published while `reports.myHistory` reads its live and
  published candidate sources
- **THEN** both source reads use the same `RepeatableRead` transaction snapshot
- **AND** the merged page contains the report exactly once or not at all,
  according to that snapshot
- **AND** a cursor never skips or duplicates an entry because publication
  occurred between the two source statements.

### Requirement: History load failures remain distinguishable and recoverable

The history page MUST distinguish a failed load from a successful empty result.
An initial personal or compiled history failure MUST show a persistent failure
state with a Retry action and MUST NOT claim that no history exists. If history
rows are already available, a later failure MUST retain them and identify the
list and summary as partial. Retry MUST use the existing role and archive scope.

#### Scenario: Initial history load fails and then recovers

- **GIVEN** the selected role's history query fails before returning data
- **WHEN** the history page renders
- **THEN** it shows a persistent failure and Retry without an empty-history claim
- **AND** a successful Retry replaces the failure with the returned history

#### Scenario: A later page fails after history rows were loaded

- **GIVEN** a personal history page has loaded and advertises a next cursor
- **WHEN** the following page fails
- **THEN** already loaded rows remain visible with a partial-history explanation
- **AND** the failed cursor is not repeatedly requested by automatic pagination

#### Scenario: Switching compiled archive scope fails

- **GIVEN** compiled history rows are displayed for the current archive scope
- **WHEN** the user changes the archive scope and its request fails
- **THEN** the previously displayed rows remain with a partial-history explanation
- **AND** Retry requests the newly selected archive scope

### Requirement: Personal history advances only while successful and idle

Automatic personal history pagination MUST stop after a page error and MUST NOT
start a next-page request while another query fetch is active. A deliberate
Retry after a next-page failure MUST retry that page while preserving earlier
pages. Successful pagination MUST continue to the explicit terminal cursor.

#### Scenario: Retry appends the previously failed page

- **GIVEN** the next personal history page failed after earlier pages loaded
- **WHEN** the user retries and the page succeeds
- **THEN** its records append to earlier pages without replacing them
- **AND** no further page is requested when nextCursor is null

#### Scenario: An active request cannot be duplicated by rendering

- **GIVEN** a history request is pending
- **WHEN** the page rerenders
- **THEN** no additional automatic next-page request starts

### Requirement: History waits for the session before presenting results

While the session is loading and no role-scoped history result is available,
the History page MUST show its loading presentation. Disabled history queries
MUST NOT be presented as a successful empty history or a zero summary. After
the session resolves, the page MUST follow the selected role's history loading,
data, error or empty state. The existing session provider error boundary MUST
remain responsible for a failed session read.

#### Scenario: Session resolves before a role-scoped history result

- **GIVEN** the History page is mounted while its session is pending
- **WHEN** the session resolves to Lead, Head, Admin or Viewer
- **THEN** no successful empty history or summary appears before resolution
- **AND** the page proceeds to the appropriate personal or compiled history

#### Scenario: Session fails to load

- **WHEN** the session read fails
- **THEN** the existing session error and retry replace the History page
- **AND** the failure is not shown as an empty history
