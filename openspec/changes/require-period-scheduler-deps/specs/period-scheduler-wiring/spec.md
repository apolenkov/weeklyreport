## ADDED Requirements

### Requirement: Scheduled Period Transitions Emit Real Audit Events

Every machine-driven period transition MUST emit its audit event to the
production AppLogger-backed `AuditLogger` sink — the three `period.auto-*`
events (`period.auto-create`, `period.auto-publish`,
`period.auto-archive`). The schedulers
(`PeriodCreatorScheduler`, `AutoPublisherScheduler`, `AutoArchiverScheduler`)
MUST NOT substitute a null-object audit logger in production, so the
compliance trail for automated lifecycle changes is never silently empty.

#### Scenario: Auto-create writes a real audit line

- **WHEN** `PeriodCreatorScheduler.runOnce` mints a new period in a
  production-wired container
- **THEN** the `AuditLogger.periodAutoCreate` call reaches the AppLogger
  sink (an observable `audit` log entry), not `createNullAuditLogger()`

#### Scenario: Auto-publish writes a real audit line

- **WHEN** `AutoPublisherScheduler.runOnce` publishes a due draft period
- **THEN** the `AuditLogger.periodAutoPublish` call reaches the AppLogger
  sink with the period id and missing-section count

#### Scenario: Auto-archive writes a real audit line

- **WHEN** `AutoArchiverScheduler.runOnce` archives a period past its
  retention cutoff
- **THEN** the `AuditLogger.periodAutoArchive` call reaches the AppLogger
  sink with the period id

### Requirement: Scheduler And Service Dependencies Are Mandatory

Scheduler and service dependencies MUST be declared as required members with
no silent null-object or no-op default: the scheduler audit dependency and
the `PeriodService` reopen-policy, analytics-cache-invalidation, and
section-id dependencies. A missing dependency MUST fail loud at composition
time rather than degrade to a no-op at runtime.

#### Scenario: A scheduler cannot be constructed without an audit sink

- **WHEN** any of the three scheduler classes is constructed
- **THEN** the `auditLogger` is a required constructor argument (no
  `?? createNullAuditLogger()` fallback), so omitting it is a
  compile-time / DI-resolution error, not a silent no-op

#### Scenario: Reopen-policy reader is a required non-null PeriodService dependency

- **WHEN** `PeriodService` is constructed
- **THEN** `readReopenPolicy` is a required argument AND its return type is
  narrowed from `| null` to a non-null policy, so no production or future
  code path can construct the service without a reopen-policy gate wired, and
  no explicitly-passed null-returning reader can silently skip gating

#### Scenario: Analytics-cache invalidation is a required PeriodService dependency

- **WHEN** `PeriodService` is constructed
- **THEN** `invalidateAnalyticsCache` is a required argument with no
  `() => Promise.resolve(undefined)` no-op default, so a future refactor
  cannot silently drop cache invalidation after a publish

#### Scenario: listSectionIds is required and the runtime guard is gone

- **WHEN** `PeriodService.publishPeriod` runs its post-publish side effects
- **THEN** `PeriodRepository.listSectionIds` is a required (non-optional)
  port method and the `if (this.repository.listSectionIds)` existence guard
  at period.service.ts is removed — the section-id read is unconditional

### Requirement: Audit Sink Is Wired At The Composition Root

The real `AuditLogger` MUST be provided through the Nest DI graph via a
dependency-injection token supplied by a `useFactory`/`inject` provider (the
repository's known-safe shape, not `@Inject` parameter decorators), and the
three schedulers MUST resolve that one token-provided AppLogger-backed
instance rather than each reconstructing its own.

#### Scenario: Token-provided audit logger is injected into the schedulers

- **WHEN** `PeriodModule` builds the three scheduler providers
- **THEN** each scheduler factory receives the token-resolved `AuditLogger`
  through its `inject` array (no per-scheduler AppLogger reconstruction),
  so all three schedulers' audit lines flow through the one shared instance

#### Scenario: The audit sink reuses the post-CLS logger and adds no new sink

- **WHEN** the API boots
- **THEN** the AppLogger backing the audit sink is the same `APP_LOGGER`
  instance `main.ts` resolves post-CLS, so the audit path introduces no NEW
  `createAppLogger`/file sink beyond the one that already exists at that
  boundary
