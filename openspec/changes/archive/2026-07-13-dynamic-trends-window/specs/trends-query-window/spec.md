## ADDED Requirements

### Requirement: Trends page query window is derived from the current date

The Trends page SHALL derive its `trafficLightHistory` and `leadVelocity`
query window from the current date at request time, not from a hardcoded
calendar range. The window MUST land before 2027-01-01 to close the gap
where the previously hardcoded `2026-01-01`–`2026-12-31` bound would start
excluding every report.

#### Scenario: Window rolls forward with the current date

- **GIVEN** the current date is any day on or after the change lands
- **WHEN** the Trends page loads
- **THEN** `periodFrom` and `periodTo` are computed as a rolling 12-month
  span ending on the current date, not read from a fixed constant

#### Scenario: Window stays valid past the year the change ships in

- **GIVEN** the current date is 2027-06-01, one year after the previously
  hardcoded window's upper bound
- **WHEN** the Trends page loads
- **THEN** the derived window covers 2026-06-01 through 2027-06-01 and still
  includes reports published in that span

#### Scenario: Comparison query falls back to the same derived window

- **GIVEN** fewer than two published periods exist, so `latestPeriodPair`
  resolves `null`
- **WHEN** the period-comparison query builds its fallback bounds
- **THEN** it uses the same derived rolling window, not the removed
  hardcoded constants

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
