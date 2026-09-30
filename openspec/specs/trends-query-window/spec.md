# trends-query-window

## Purpose

Define how the Trends page derives its query window, handles empty results, and exposes the latest table information first.

## Requirements

### Requirement: Trends page query window is derived from the current date

The Trends page SHALL derive its `trafficLightHistory` and `leadVelocity`
query window from the current date at request time, not from a hardcoded
calendar range. The rolling window MUST remain valid across calendar-year
boundaries.

#### Scenario: Window rolls forward with the current date

- **GIVEN** any current date
- **WHEN** the Trends page loads
- **THEN** `periodFrom` and `periodTo` are computed as a rolling 12-month
  span ending on the current date, not read from a fixed constant

#### Scenario: Window stays valid across calendar years

- **GIVEN** the current date is 2027-06-01
- **WHEN** the Trends page loads
- **THEN** the derived window covers 2026-06-01 through 2027-06-01 and still
  includes reports published in that span

#### Scenario: Comparison query falls back to the same derived window

- **GIVEN** fewer than two published periods exist, so `latestPeriodPair`
  resolves `null`
- **WHEN** the period-comparison query builds its fallback bounds
- **THEN** it uses the same derived rolling window and no fixed calendar bounds

### Requirement: Trends charts show an explicit empty state for a window with no data

Each Trends chart MUST render a loud, explicit empty-state message when its
query window returns zero rows, instead of rendering blank or crashing.

#### Scenario: Traffic-light history has no periods in range

- **GIVEN** `trafficLightHistory` returns zero periods for the derived window
- **WHEN** the Trends page renders the traffic-light-history section
- **THEN** it shows "No published periods in range." instead of an empty or
  broken chart

#### Scenario: Lead velocity has no rows in range

- **GIVEN** `leadVelocity` returns zero rows for the derived window
- **WHEN** the Trends page renders the lead-velocity section
- **THEN** it shows "No velocity data in range." instead of an empty or
  broken chart

### Requirement: Trends tables expose the latest information first

At `/reports/trends`, Traffic-light history and Lead submissions MUST render
period columns newest first, immediately after the sticky project or lead
identity column. Period comparison MUST place Latest status immediately after
Project, followed by Previous status and the existing risk comparison columns.
The identity column MUST remain compact enough that the latest header and
complete status or submission cell are visible at 375 CSS pixels before
scrolling. Names MUST wrap, and internal table scrolling MUST have a visible
cue while preserving the named keyboard-focusable region.

This ordering MUST change presentation only. Traffic-light history MUST map
each displayed period to its original status index, and latest change markers
MUST still compare that period with its preceding chronological period. Lead
submissions headers and cells MUST use the same reversed render order without
mutating query results. Query windows, summaries, risk-change direction,
aggregation and original data order MUST remain unchanged. Returned period
metadata MUST follow the frozen publication range contract.

#### Scenario: A mobile reader opens populated Trends

- **WHEN** Traffic-light history or Lead submissions contains several periods at 375 CSS pixels
- **THEN** its first period header is the newest and the corresponding full cell is visible beside the name
- **AND** a visible cue explains how to reach the remaining columns

#### Scenario: Display order changes without changing a transition

- **GIVEN** a project's earlier and latest periods have different known statuses
- **WHEN** Traffic-light history renders newest first
- **THEN** each badge still belongs to its original period
- **AND** the latest marker retains its original Recovered or Slipped meaning

#### Scenario: Comparison shows latest status beside Project

- **WHEN** Period comparison renders its existing previous/latest pair
- **THEN** Latest status precedes Previous status with values aligned to those headers
- **AND** risk change remains latest minus previous

#### Scenario: A table has one or no period

- **WHEN** Traffic-light history or Lead submissions has one period or no rows
- **THEN** a single period retains its corresponding values without a fabricated previous-period marker
- **AND** the existing explicit empty state remains when there are no rows

### Requirement: Trends displays actual publication ranges with years

At `/reports/trends`, Traffic-light history headers, its latest-period summary,
Lead submissions headers, and the Period comparison explanation MUST display
both actual frozen dates with explicit years. Labels MUST describe Period or
Periods without assuming seven-day weeks. Manual ranges, including ranges
longer than the duration-setting limit of 31 days, MUST retain their dates.
The comparison explanation MUST use metadata from its response; missing sides
MUST show an empty date indication. Comparison queries MUST still select the
latest two chronological history end labels. Accessible table regions,
newest-first presentation, chronological cell alignment, and latest-minus-
previous risk direction MUST remain intact.

#### Scenario: Period duration and calendar boundaries vary

- **WHEN** published periods last 1, 7, 30, or 31 days, begin midweek, cross a month or year, or use the same month in different years
- **THEN** all Trends range labels show the actual start and end with unambiguous years

#### Scenario: Response metadata differs from the query end label

- **WHEN** comparison returns an admitted frozen snapshot's range
- **THEN** its explanation displays that returned range alongside its cells
