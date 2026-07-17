## ADDED Requirements

### Requirement: Dashboard surfaces MUST NOT present placeholder state as live data

The head dashboard SHALL only render loading affordances and KPI values that
correspond to real, currently-queryable state; any client-side script or
component that relies on a DOM marker MUST query a marker that some
component actually renders, and any metric with no backing data source MUST
be presented as explicitly unavailable rather than as a fabricated number.

#### Scenario: bfcache-recovery script detects a real loading marker

- **WHEN** the head dashboard is restored from the browser back-forward
  cache while a panel (kpi, leads, or blocked) is still loading
- **THEN** the dashboard root renders a DOM marker reflecting that loading
  state
- **AND** the bfcache-recovery script's selector matches that marker and
  triggers a reload

#### Scenario: bfcache-recovery script is a no-op once loading completes

- **WHEN** the head dashboard is restored from the browser back-forward
  cache after all panels have finished loading
- **THEN** no loading marker is present in the DOM
- **AND** the bfcache-recovery script does not reload the page

#### Scenario: last-week submission comparison renders as unavailable, not zero

- **WHEN** the dashboard KPI strip is built from a `WeeklyReportReadModel`
  that has no prior-period submission data
- **THEN** the KPI card does not render a numeric "Last week 0/0" comparison
- **AND** it instead renders an explicit not-available presentation
