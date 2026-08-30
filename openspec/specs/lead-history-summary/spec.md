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
