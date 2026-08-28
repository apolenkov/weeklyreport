## ADDED Requirements

### Requirement: Scheduler And Product-Owned Service Dependencies Are Mandatory

Scheduler and service dependencies MUST be declared as required members with no silent null-object or no-op default: the scheduler audit dependency and the `PeriodService` reopen-policy and analytics-cache-invalidation dependencies. A missing dependency MUST fail loud at composition time rather than degrade to a no-op at runtime. `PeriodService` MUST NOT require a repository read or collaborator whose only purpose is deferred publish ingestion.

#### Scenario: A scheduler cannot be constructed without an audit sink

- **WHEN** any of the three scheduler classes is constructed
- **THEN** the `auditLogger` is a required constructor argument with no null-object fallback
- **AND** omitting it is a compile-time or dependency-resolution error

#### Scenario: Reopen-policy reader is a required non-null PeriodService dependency

- **WHEN** `PeriodService` is constructed
- **THEN** `readReopenPolicy` is a required argument with a non-null policy return type
- **AND** no production or future code path can silently skip the reopen-policy gate

#### Scenario: Analytics-cache invalidation is a required PeriodService dependency

- **WHEN** `PeriodService` is constructed
- **THEN** `invalidateAnalyticsCache` is a required argument with no no-op default
- **AND** a future refactor cannot silently drop cache invalidation after a publish

#### Scenario: Publish has no ingestion-only section-id dependency

- **WHEN** `PeriodService.publishPeriod` runs its post-publish side effects
- **THEN** its repository port exposes no `listSectionIds` method used only for deferred ingestion
- **AND** the service performs no section-id read after the publish transaction

## REMOVED Requirements

### Requirement: Scheduler And Service Dependencies Are Mandatory

**Reason**: The requirement combined valid scheduler, reopen-policy, and cache dependencies with `PeriodRepository.listSectionIds`, an ingestion-only dependency for a feature outside the current MVP.

**Migration**: Use `Scheduler And Product-Owned Service Dependencies Are Mandatory`, which preserves every product-owned fail-loud dependency and explicitly removes speculative ingestion coupling.
