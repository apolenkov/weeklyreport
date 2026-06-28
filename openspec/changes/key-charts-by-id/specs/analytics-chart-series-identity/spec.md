## ADDED Requirements

### Requirement: Analytics chart series are keyed by stable entity id

`LeadVelocityChart` and `TrafficLightHistoryChart` MUST key each recharts data
series by the stable entity identifier (`leadId` or `projectId`) rather than by
the display name. The `dataKey` prop on every `Bar` / `Line` element MUST
reference the UUID-keyed column in the per-period data array so two entities
that share a display name each retain their own data without collision.

#### Scenario: two leads share a display name in LeadVelocityChart

- **WHEN** `LeadVelocityChart` receives two lead entries with identical
  `leadName` values but distinct `leadId` values for the same period
- **THEN** each lead's `submittedSections` count is present independently in
  the rendered output
- **AND** neither lead's value is overwritten by the other's

#### Scenario: two projects share a display name in TrafficLightHistoryChart

- **WHEN** `TrafficLightHistoryChart` receives two rows with identical
  `projectName` values but distinct `projectId` values
- **THEN** each project's status history is preserved independently in the
  rendered output
- **AND** neither project's status series is silently dropped

### Requirement: Display names appear in legend and tooltip via the name prop

Each `Bar` in `LeadVelocityChart` MUST carry a `name` prop set to the lead's
display name, and each `Line` in `TrafficLightHistoryChart` MUST carry a `name`
prop set to the project's display name, so recharts legend entries and tooltip
labels show human-readable names while the underlying data column key is a UUID.

#### Scenario: legend shows lead names when leads share a display name

- **WHEN** `LeadVelocityChart` renders with two leads that have the same
  `leadName`
- **THEN** each `Bar` element has a `name` attribute equal to the shared
  `leadName`
- **AND** the `dataKey` of each `Bar` element differs between the two (one
  per `leadId`)

#### Scenario: legend shows project names in TrafficLightHistoryChart

- **WHEN** `TrafficLightHistoryChart` renders with at least one project row
- **THEN** each `Line` element has a `name` attribute equal to its
  `projectName`
- **AND** the `dataKey` of each `Line` element is the corresponding
  `projectId`

### Requirement: The period x-axis key is unaffected by the id-keying change

The recharts `XAxis` `dataKey` in both analytics charts MUST remain the literal
string `"period"` after entity columns switch to UUID keys; UUID column keys
MUST NOT collide with the `"period"` key or alter x-axis rendering.

#### Scenario: the x-axis still renders period labels after the fix

- **WHEN** either analytics chart renders with two or more periods
- **THEN** the `XAxis` `dataKey` is `"period"`
- **AND** each data point contains exactly one `"period"` entry alongside
  UUID-keyed entity columns
