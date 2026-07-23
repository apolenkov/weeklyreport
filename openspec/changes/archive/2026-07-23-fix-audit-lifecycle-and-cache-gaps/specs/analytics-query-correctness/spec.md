## ADDED Requirements

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
