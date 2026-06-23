# lead-history-summary Specification

## Purpose

TBD - created by archiving change lead-history-and-submit-label. Update Purpose after archive.

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
view and MUST NOT depend on a `tab` query parameter. Legacy history
entry points (`/lead/history`, `/head/history`) MUST redirect to
`/reports` without a `tab` parameter, and the page MUST NOT carry copy or
comments promising tabs that are not implemented.

#### Scenario: Legacy lead history route lands on the unified page

- **WHEN** a lead navigates to `/lead/history`
- **THEN** the browser is redirected to `/reports` with no `tab`
  parameter
- **AND** the lead sees their role-defaulted personal history

#### Scenario: A stray tab parameter changes nothing

- **WHEN** `/reports?tab=drafts` is opened directly
- **THEN** the page renders the same role-defaulted history as `/reports`
  with no tab affordance

### Requirement: History navigation links carry no tab parameter

The NavBar History link MUST target `/reports` with no `tab` query parameter
for every role that sees it (lead, head, viewer). The `tab` parameter is dead —
`reports/page.tsx` does not read it — so the navigation MUST NOT emit it. This
complements the existing rule that the reports history page carries no tab
state: neither the page nor the links that reach it depend on a `tab` param.

A stray `tab` parameter typed directly into the address bar still resolves to
the same History view (back-compat), and the History link still renders active
on `/reports` and on published-report paths regardless of any stray param.

#### Scenario: the History nav link omits the tab param

- **WHEN** the NavBar renders the History link for a lead, head, or viewer
- **THEN** the link's href is `/reports` with no `tab` query parameter

#### Scenario: History stays active on a stray tab URL

- **WHEN** `/reports?tab=drafts` or `/reports?tab=published` is open directly
- **THEN** the History nav link still renders as the active link
