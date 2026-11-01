# period-scheduler-wiring Specification

## Purpose

Make scheduled period transitions race-safe, independently reconciled, and auditable through mandatory scheduler dependencies wired at the composition root.

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
- **AND** concurrent scheduler publication of a newer period and Head reopen of an earlier period MAY resolve as the legal serial order reopen then auto-publish.

#### Scenario: Auto-archive writes a real audit line

- **WHEN** `AutoArchiverScheduler.runOnce` archives a period past its
  retention cutoff
- **THEN** the `AuditLogger.periodAutoArchive` call reaches the AppLogger
  sink with the period id

#### Scenario: Publication commits before an unrelated count read becomes unavailable

- **WHEN** auto publication returns a committed report with draft sections
- **THEN** the scheduler records success and audits the count of draft sections from that returned report without an additional post-commit count read
- **AND** skipped/no-write outcomes remain unaudited

### Requirement: Scheduler And Product-Owned Service Dependencies Are Mandatory

Scheduler and service dependencies MUST be declared as required members with
no silent null-object or no-op default: the scheduler audit dependency and
the `PeriodService` reopen-policy and analytics-cache-invalidation dependencies.
A missing dependency MUST fail loud at composition time rather than degrade to
a no-op at runtime. `PeriodService` MUST NOT require a repository read or
collaborator for publish ingestion; publishing has no ingestion dependency.

#### Scenario: A scheduler cannot be constructed without an audit sink

- **WHEN** any of the three scheduler classes is constructed
- **THEN** the `auditLogger` is a required constructor argument with no
  null-object fallback
- **AND** omitting it is a compile-time or dependency-resolution error

#### Scenario: Reopen-policy reader is a required non-null PeriodService dependency

- **WHEN** `PeriodService` is constructed
- **THEN** `settings` is a required constructor argument whose
  `getSettings` method returns a non-null reopen policy
- **AND** no production code path can silently skip the reopen-policy gate

#### Scenario: Analytics-cache invalidation is a required PeriodService dependency

- **WHEN** `PeriodService` is constructed
- **THEN** `cache` is a required constructor argument whose
  `invalidateAll` method has no no-op default
- **AND** every successful publish invalidates the analytics cache

#### Scenario: Publish has no ingestion section-id dependency

- **WHEN** `PeriodService.publishPeriod` runs its post-publish side effects
- **THEN** its repository port exposes no ingestion-only section-id lookup
- **AND** the service performs no section-id read after the publish transaction

### Requirement: Audit Sink Is Wired At The Composition Root

The real `AuditLogger` MUST be provided through the existing `AUDIT_LOGGER`
`useFactory`/`inject` provider exported by `ConfigModule`, backed by the
shared `APP_LOGGER`. `PeriodModule` MUST register `PeriodCreatorScheduler`
as a class provider whose required audit constructor argument uses
`@Inject(AUDIT_LOGGER)`. `AutoPublisherScheduler` and `AutoArchiverScheduler`
MUST receive that token through their `useFactory`/`inject` providers.
The three schedulers MUST resolve that one token-provided AppLogger-backed
instance rather than each reconstructing its own.

#### Scenario: Token-provided audit logger is injected into the schedulers

- **WHEN** `PeriodModule` builds the three scheduler providers
- **THEN** `PeriodCreatorScheduler` receives the token-resolved `AuditLogger`
  through `@Inject(AUDIT_LOGGER)` on its required constructor argument
- **AND** the `AutoPublisherScheduler` and `AutoArchiverScheduler` factories
  receive the same token through their `inject` arrays
- **AND** all three schedulers' audit lines flow through the one shared
  instance, with no per-scheduler AppLogger reconstruction

#### Scenario: The audit sink reuses the post-CLS logger and adds no new sink

- **WHEN** the API boots
- **THEN** the AppLogger backing the audit sink is the same `APP_LOGGER`
  instance `main.ts` resolves post-CLS, so the audit path introduces no NEW
  `createAppLogger`/file sink beyond the one that already exists at that
  boundary

### Requirement: The scheduled-to-open flip is a guarded compare-and-set

`flipDueScheduledToOpen` MUST write each due row's transition as a guarded
update that re-asserts the selected `periodStart` and `periodEnd`,
`periodStart <= now`, `periodState: 'scheduled'`, and the complete draft
lifecycle boundary (`status: 'draft'`, `periodStatus: 'open'`, unarchived,
not auto-published/archived, and null publication/reopen fields) in the same
statement as the write (a Prisma `updateMany` with that predicate, or an
equivalent atomic compare-and-set) — never an unconditional update keyed only
on the row's id. When the guarded write affects zero rows, the scheduler MUST
treat it as a benign concurrent-writer skip (log and continue), the same way
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
  `buildTransition('open', {})` field set

### Requirement: Auto-archive asserts the exact published identity before writing

`AutoArchiverScheduler` MUST select and write its archive through one guarded
predicate on the row's `id`, `archived: false`, `periodStatus: 'published'`
and the `publishedAt` value captured by the selection scan — never by `id`
alone. Matching `publishedAt` keeps a stale scan from archiving a row that a
concurrent writer republished under the same id, and a zero-row write means
the row left the eligible state concurrently and is skipped, never forced.
The write applies the governed `buildTransition('autoArchive', {})` field set.

#### Scenario: A republished row is not archived by a stale scan

- **GIVEN** an archived-eligible row that a concurrent writer republishes
  before the archive write executes
- **WHEN** `AutoArchiverScheduler` processes it
- **THEN** the guarded write affects zero rows
- **AND** the row remains published with its new `publishedAt`

### Requirement: At most one row per scheduling boundary across scheduled and open states

The database MUST NOT permit two rows sharing the same `(periodStart,
periodEnd)` boundary to both be in a live pre-published state
(`scheduled` or `open`) at once. The database exclusion constraint MUST reject
overlapping editable ranges at write time; no duplicate-reconciliation path is
required.

#### Scenario: Two concurrent creators cannot both persist a scheduled row for the same boundary

- **WHEN** two period-creation attempts race for the same
  `(periodStart, periodEnd)` boundary
- **THEN** at most one `scheduled` (or `open`) row for that boundary survives,
  because the database rejects the overlapping write

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

### Requirement: Current-period lookup selects only a coupled live tuple

The login-time and scheduler current-period factory MUST select an existing
report only when companion publication status is draft, archived is false, canonical state is
scheduled or open, and all lifecycle fields form a valid tuple for the requested
boundary. The factory MUST first return the exact live scheduling boundary when
one exists; when no exact boundary exists, it MUST return the single valid live
`scheduled` or `open` manual range containing the anchor date rather than
creating an overlapping canonical week. A live range that only partially
overlaps the canonical week and does not contain the anchor MUST still surface
the typed overlap error from the database write path. If a manual range commits
after both lookups but before canonical creation, the overlap-error recovery
MUST re-read the exact boundary and then the containing range before returning
the typed conflict.

#### Scenario: Archived draft occupies the requested boundary

- **WHEN** an archived row retains draft publication status and its dates contain the requested instant
- **THEN** current-period lookup excludes that row and finds or creates the valid live row

#### Scenario: Contradictory row occupies the requested boundary

- **WHEN** a row matches the date boundary but its canonical and companion lifecycle fields disagree
- **THEN** lookup fails with a typed integrity error and MUST NOT return or overwrite the row

#### Scenario: Manual range contains the login anchor

- **WHEN** no exact scheduler boundary exists and one valid live manual range
  contains the anchor date
- **THEN** the factory returns that range without creating a new report

#### Scenario: Manual range wins during canonical creation

- **WHEN** both initial lookups find no row, a live manual range containing the
  anchor commits, and canonical creation then hits the named overlap constraint
- **THEN** recovery re-reads the exact boundary and containing range
- **AND** the factory returns the committed manual range without creating a
  second report

#### Scenario: Partial overlap does not contain the anchor

- **WHEN** no exact boundary exists and a live manual range overlaps the
  canonical week but ends before the anchor date
- **THEN** canonical creation fails with the typed period-overlap error

#### Scenario: Valid scheduled or open row exists

- **WHEN** exactly one complete live tuple matches the requested boundary
- **THEN** the factory returns that row without creating a duplicate

#### Scenario: A valid reopened publication matches the boundary

- **WHEN** a schema-valid reopened publication matches the exact or containing lookup range
- **THEN** it is excluded from draft current-period lookup
- **AND** invalid tuples still fail integrity validation and named overlap conflicts retain their current policy

### Requirement: Arbitrary editable period ranges cannot overlap under concurrency

The period-admin create and update tRPC paths MUST serialize the overlap
decision so that two distinct editable `scheduled` or `open` date ranges that
overlap cannot both commit. Exact-boundary uniqueness alone MUST NOT establish
this invariant. Published and archived rows MUST remain outside the database
range constraint because legitimate republish history can share a period
envelope; their date envelopes remain frozen until the lifecycle is made
editable again. A manual envelope update MUST re-check the lifecycle tuple while
holding the report row lock and MUST reject a date/deadline edit whose expected
state is stale; `weekLabel`-only edits remain allowed for published and archived
rows.

#### Scenario: Concurrent overlapping creates

- **WHEN** two authorized requests concurrently create different but
  overlapping period ranges
- **THEN** at most one range commits
- **AND** the losing request returns the canonical typed overlap conflict
  without report or reminder side effects

#### Scenario: Lifecycle transition wins before a manual envelope update

- **GIVEN** a manual PATCH read an editable period and requested a date or
  deadline change
- **WHEN** publish or archive commits before the PATCH acquires its transaction
  lock
- **THEN** the PATCH returns the typed stale-state conflict
- **AND** the period's date envelope remains unchanged
- **AND** a `weekLabel`-only PATCH remains allowed after the transition

#### Scenario: Non-overlapping ranges race

- **WHEN** two authorized requests concurrently create non-overlapping period
  ranges
- **THEN** both may commit independently

### Requirement: Period module composition is executable

The production Nest composition root, including `PeriodModule`, MUST resolve
the period service, every period scheduler, its audit logger, and automatic
carry-over dependency exactly once. Metadata-only declarations MUST NOT
substitute for a real composition test.

#### Scenario: Application module is compiled

- **WHEN** the production composition root is built with its required
  infrastructure providers
- **THEN** all period services and schedulers resolve without an
  unknown-dependency or silent no-op fallback

### Requirement: Auto carry-over uses the publication source of truth

When the previous source period is published, auto carry-over MUST derive its
source sections and author set from that period's validated immutable
`publishedSnapshot`. It MUST NOT require mutable source sections to exist.
Before materializing target sections, it MUST intersect the frozen author ids
with current existing active users, as defined by `carry-over-automation`.
Missing or deactivated historical authors MUST neither receive target sections
nor abort carry-over for eligible authors. Draft and reopened source periods
continue to use their live sections and active authors.

#### Scenario: Published source survives recovery and later mutation

- **GIVEN** the previous period is published and its live section graph is
  absent or has changed after publication
- **WHEN** auto carry-over opens the next period
- **THEN** it copies carryable records from the validated publication snapshot
  for frozen authors who still exist and are active
- **AND** it does not read the mutable published source graph

### Requirement: Daily period lifecycle schedulers run in UTC

The daily `PeriodCreatorScheduler` and `AutoArchiverScheduler` cron jobs MUST
use the existing `5 0 * * *` and `15 0 * * *` expressions with an explicit
`timeZone: "UTC"` option. Their wall-clock execution MUST therefore remain
00:05 UTC and 00:15 UTC regardless of the API host process timezone.

#### Scenario: The creator keeps its UTC boundary

- **WHEN** the Nest Schedule metadata for `PeriodCreatorScheduler.runDaily` is
  registered
- **THEN** its cron expression is `5 0 * * *`
- **AND** its timezone is `UTC`
- **AND** its next execution from a fixed UTC instant is 00:05 UTC

#### Scenario: The archiver keeps its UTC boundary

- **WHEN** the Nest Schedule metadata for `AutoArchiverScheduler.runDaily` is
  registered
- **THEN** its cron expression is `15 0 * * *`
- **AND** its timezone is `UTC`
- **AND** its next execution from a fixed UTC instant is 00:15 UTC
