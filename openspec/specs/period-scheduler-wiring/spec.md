# period-scheduler-wiring Specification

## Purpose

TBD - created by archiving change require-period-scheduler-deps. Update Purpose after archive.

## Requirements

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

### Requirement: The scheduled-to-open flip is a guarded compare-and-set

`flipDueScheduledToOpen` MUST write each due row's transition as a guarded
update that re-asserts `periodState: 'scheduled'` in the same statement as
the write (a Prisma `updateMany` with that predicate, or an equivalent
atomic compare-and-set) — never an unconditional update keyed only on the
row's id. When the guarded write affects zero rows, the scheduler MUST treat
it as a benign concurrent-writer skip (log and continue), the same way
`AutoArchiverScheduler`'s guarded write treats its own zero-row case, so a
row that a concurrent writer (for example an admin archive) transitioned
away from `scheduled` inside the same cron tick is never silently
overwritten back to `open`.

#### Scenario: A concurrently archived row is not clobbered by the flip

- **GIVEN** a `scheduled` row that `flipDueScheduledToOpen` selected as due
- **WHEN** another writer archives that row after the selection scan but
  before the flip's write executes
- **THEN** the flip's guarded write affects zero rows
- **AND** the row remains archived — its `periodState` and `archived` fields
  are not reset to `open`/`false`

#### Scenario: A row still scheduled at flip time opens normally

- **GIVEN** a `scheduled` row whose `periodStart` has been reached and which
  no concurrent writer has touched
- **WHEN** `flipDueScheduledToOpen` processes it
- **THEN** the row transitions to `open` via the full governed
  `buildTransition('open', {})` field set, unchanged from prior behavior

### Requirement: At most one row per scheduling boundary across scheduled and open states

The database MUST NOT permit two rows sharing the same `(periodStart,
periodEnd)` boundary to both be in a live pre-published state
(`scheduled` or `open`) at once. A duplicate `scheduled` row inserted by a
racing concurrent creator MUST NOT persist as a permanent orphan once its
boundary's winning row reaches `open` — either the uniqueness guarantee is
enforced at insert time across both states, or a reconcile step removes the
losing duplicate once the boundary resolves.

#### Scenario: Two concurrent creators cannot both persist a scheduled row for the same boundary

- **WHEN** two period-creation attempts race for the same
  `(periodStart, periodEnd)` boundary
- **THEN** at most one `scheduled` (or `open`) row for that boundary
  survives — the loser either fails its insert/update or is reconciled away

#### Scenario: A duplicate scheduled row does not sit orphaned forever

- **GIVEN** a duplicate `scheduled` row exists for a boundary whose other
  row has already opened
- **WHEN** the scheduler runs a subsequent tick
- **THEN** the duplicate is not left indefinitely re-scanned and
  warn-logged with no resolution — it is either prevented from having been
  created in the first place, or removed

### Requirement: Due scheduled periods open independently of automatic period creation

`PeriodCreatorScheduler.runOnce` MUST invoke the governed scheduled-to-open transition for every due `Report` whose `periodState` is `scheduled` and whose `periodStart` has been reached, regardless of the `AppSettings.autoCreatePeriods` value. Disabling automatic period creation MUST prevent creation of a new period, but MUST NOT prevent an already-scheduled period from transitioning to `open`. The transition MUST continue to use `flipDueScheduledToOpen` and its guarded `buildTransition('open', {})` field set so the period dual-state remains atomic.

#### Scenario: A due scheduled period opens while automatic creation is disabled

- **GIVEN** `AppSettings.autoCreatePeriods` is `false`
- **AND** a report has `periodState: 'scheduled'` and `periodStart <= now`
- **WHEN** `PeriodCreatorScheduler.runOnce(now)` executes
- **THEN** `flipDueScheduledToOpen` transitions the report to `periodState: 'open'` using the full governed transition field set
- **AND** the scheduler creates no new report

#### Scenario: A future scheduled period remains scheduled

- **GIVEN** `AppSettings.autoCreatePeriods` is `false`
- **AND** a report has `periodState: 'scheduled'` and `periodStart > now`
- **WHEN** `PeriodCreatorScheduler.runOnce(now)` executes
- **THEN** the report remains `scheduled`
- **AND** the scheduler creates no new report

### Requirement: Every tick reconciles auto carry-over for open periods

`PeriodCreatorScheduler.runOnce` MUST, after the scheduled-to-open flip and
before any create decision, invoke the auto carry-over hook once for every
`Report` with `periodState: 'open'`, `periodStatus: 'open'` and
`archived: false` — a sweep of all such periods, not only rows this tick
flipped, so a carry that failed transiently on an earlier tick is retried.
Reopened periods (`periodStatus: 'reopened'`) and archived rows MUST be
excluded, so a reopen never re-triggers carry. The sweep MUST run regardless of
the `AppSettings.autoCreatePeriods` value: carry-over follows a period becoming
open, and that setting governs creation only. Consequently a tick with creation
disabled MAY still materialize lead sections and clone carried items and
decisions into a period the flip opened, exactly as
`carry-over-automation` specifies for the enabled case. The hook itself MUST
absorb every carry failure and never reject, so a failed carry cannot abort the
tick; the sweep adds no guard of its own.

#### Scenario: A period opened while creation is disabled still receives carry-over

- **GIVEN** `AppSettings.autoCreatePeriods` is `false`
- **AND** a report has `periodState: 'open'`, `periodStatus: 'open'` and `archived: false`
- **WHEN** `PeriodCreatorScheduler.runOnce(now)` executes
- **THEN** the auto carry-over hook is invoked for that report
- **AND** the scheduler creates no new report

#### Scenario: Reopened and archived periods are not swept

- **GIVEN** a report whose `periodStatus` is `reopened`, and another that is `archived`
- **WHEN** `PeriodCreatorScheduler.runOnce(now)` executes
- **THEN** the auto carry-over hook is not invoked for either report
