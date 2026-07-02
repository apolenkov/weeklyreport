## ADDED Requirements

### Requirement: Analytics chart series are keyed by stable entity id

`LeadVelocityChart` and `TrafficLightHistoryChart` MUST key each recharts data
series by the stable entity identifier (`leadId` or `projectId`) rather than by
the display name. The `dataKey` prop on every `Bar` / `Line` element MUST
reference the UUID-keyed column in the per-period data array so two entities
that share a display name each retain their own data without collision.

#### Scenario: two leads share a display name in LeadVelocityChart

- **WHEN** `LeadVelocityChart` builds its chart data from two lead entries with
  identical `leadName` values but distinct `leadId` values for the same period
- **THEN** that period's data point holds two separate columns, one keyed by
  each `leadId`, each carrying that lead's own `submittedSections` count
- **AND** neither lead's value is overwritten by the other's

#### Scenario: two projects share a display name in TrafficLightHistoryChart

- **WHEN** `TrafficLightHistoryChart` builds its chart data from two rows with
  identical `projectName` values but distinct `projectId` values
- **THEN** each period's data point holds two separate columns, one keyed by
  each `projectId`, each carrying that project's own status value
- **AND** neither project's status series is silently dropped

### Requirement: Display names appear via the recharts name prop

Each `Bar` in `LeadVelocityChart` MUST carry a `name` prop set to the lead's
display name so its recharts legend and tooltip entries show the human-readable
name, and each `Line` in `TrafficLightHistoryChart` MUST carry a `name` prop set
to the project's display name so its recharts tooltip labels show the
human-readable name, while the underlying data column key is a UUID.
`TrafficLightHistoryChart` renders a tooltip but no legend, so its `name` prop
surfaces only in the tooltip.

#### Scenario: bar series carry lead names when leads share a display name

- **WHEN** `LeadVelocityChart` builds its bar series for two leads that have the
  same `leadName`
- **THEN** each series descriptor carries a `name` equal to the shared `leadName`
- **AND** each series descriptor's `dataKey` differs between the two (one
  per `leadId`)

#### Scenario: tooltip series carry project names in TrafficLightHistoryChart

- **WHEN** `TrafficLightHistoryChart` builds its line series for at least one
  project row
- **THEN** each series descriptor carries a `name` equal to its `projectName`
- **AND** each series descriptor's `dataKey` is the corresponding `projectId`

### Requirement: The period x-axis key is unaffected by the id-keying change

The recharts `XAxis` `dataKey` in both analytics charts MUST remain the literal
string `"period"` after entity columns switch to UUID keys; UUID column keys
MUST NOT collide with the `"period"` key or alter x-axis rendering.

#### Scenario: the x-axis still renders period labels after the fix

- **WHEN** either analytics chart renders with two or more periods
- **THEN** the `XAxis` `dataKey` is `"period"`
- **AND** each data point contains exactly one `"period"` entry alongside
  UUID-keyed entity columns
