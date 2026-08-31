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
aggregates. The exclusion MUST be disclosed in plain text beside the
figures (e.g. "N draft not included in aggregates") whenever at least one
draft exists.

#### Scenario: A draft period does not inflate the aggregates

- **WHEN** a lead has completed periods plus one draft period
- **THEN** the traffic-light totals, average items, and total risks count
  only the completed periods
- **AND** a note discloses that the draft is not included

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
- **THEN** `nextCursor` is `null`; the API never silently truncates history
  counts from the immutable snapshot
- **AND** the query does not fall back to the mutable published graph

#### Scenario: Personal history uses one repeatable-read snapshot

- **WHEN** a report is published while `reports.myHistory` reads its live and
  published candidate sources
- **THEN** both source reads use the same `RepeatableRead` transaction snapshot
- **AND** the merged page contains the report exactly once or not at all,
  according to that snapshot
- **AND** a cursor never skips or duplicates an entry because publication
  occurred between the two source statements.
