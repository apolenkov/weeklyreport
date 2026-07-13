# analytics-query-correctness

## Purpose

Keep analytics query results and cache keys correct under lead scoping, republished periods, and nested cache-key inputs.

## Requirements

### Requirement: trafficLightHistory's lead filter scopes section aggregation

When `TrafficLightHistoryInput.leadId` is set, the query MUST restrict which
sections are aggregated into the output rows to that lead's own sections,
not only which reports qualify for inclusion.

#### Scenario: a leadId-filtered call returns only that lead's projects

- **WHEN** `trafficLightHistory` is called with `leadId` set to a specific
  lead who shares report periods with other in-scope leads
- **THEN** the returned `rows` contain only projects drawn from that lead's
  sections
- **AND** projects belonging solely to other in-scope leads' sections are
  absent from the result

### Requirement: leadVelocity aggregates by period label

`leadVelocity` MUST group reports by their period label
(`isoDateOnly(periodEnd)`) before producing output rows, so that multiple
reports sharing a period label (a republished period) produce one combined
row rather than one row per report.

#### Scenario: a republished period collapses into one row

- **WHEN** two published reports share the same `periodEnd` calendar day
  (a republished period)
- **THEN** `leadVelocity`'s output contains exactly one row for that period
  label
- **AND** that row's `leads` array contains the submitted sections from both
  reports

### Requirement: analytics cache keys hash nested objects correctly

The analytics service's cache-key hashing function MUST sort object keys at
every nesting level independently, not only at the top level, so that two
structurally-equivalent inputs (including nested objects) always produce the
same cache key, and two inputs differing at any depth always produce
different keys.

#### Scenario: a nested key survives hashing

- **WHEN** two cache-key inputs are deep-equal except that a nested object's
  key ordering differs
- **THEN** the two inputs hash to the same cache key

#### Scenario: a nested value difference changes the hash

- **WHEN** two cache-key inputs are identical except for a nested object
  key's value
- **THEN** the two inputs hash to different cache keys
