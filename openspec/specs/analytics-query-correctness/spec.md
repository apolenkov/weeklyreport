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

### Requirement: Published-floor analytics queries exclude reopened periods

Published-floor analytics queries MUST require both legacy `status:
'published'` and `periodStatus: 'published'`. A legacy-published report whose
period is currently reopened MUST be absent from `trafficLightHistory`,
`leadVelocity`, and `periodComparison` until it is re-published.

#### Scenario: A reopened period is absent from analytics

- **GIVEN** a report with `status: 'published'` and `periodStatus: 'reopened'`
- **WHEN** any published-floor analytics query covers that report's period
- **THEN** the query returns no data derived from that report

#### Scenario: A re-published period reappears in analytics

- **GIVEN** the same report has been re-published and its `periodStatus` is
  `'published'` again
- **WHEN** any published-floor analytics query covers that report's period
- **THEN** the report's re-published sections are included normally

### Requirement: Every successful publish path invalidates the analytics cache

Every successful report-publish path, including `PeriodService.publishPeriod` and `PublicationService.publishAuto`, MUST invalidate `AnalyticsCache` after the publish commits. `emitPublishSideEffects` MUST require an analytics-cache invalidation dependency; a composition root or caller MUST NOT silently omit it. The next call to `AnalyticsService.trafficLightHistory`, `leadVelocity`, or `periodComparison` after publish MUST recompute against post-publish data rather than serve a cached pre-publish value.

#### Scenario: Automatic publish evicts a cached pre-publish analytics result

- **GIVEN** an analytics query has cached a result before a due report is published
- **WHEN** `PublicationService.publishAuto` successfully publishes that report
- **THEN** the matching analytics cache entries are invalidated
- **AND** the next analytics read recomputes and does not return the cached pre-publish result

#### Scenario: Manual publish evicts a cached pre-publish analytics result

- **GIVEN** an analytics query has cached a result before a report is published
- **WHEN** `PeriodService.publishPeriod` successfully publishes that report
- **THEN** the matching analytics cache entries are invalidated
- **AND** the next analytics read recomputes and does not return the cached pre-publish result
