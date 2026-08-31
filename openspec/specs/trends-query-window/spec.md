# trends-query-window

## Purpose

Define how the Trends page derives its query window and handles empty results.

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
