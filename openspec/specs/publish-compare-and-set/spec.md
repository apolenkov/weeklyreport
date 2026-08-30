# publish-compare-and-set Specification

## Purpose

Publish reports through one guarded compare-and-set that classifies zero-row outcomes, snapshots a fresh transactional read, and centralizes post-publish side effects.

## Requirements

### Requirement: Single Shared Publish Compare-And-Set Helper

The manual-publish compare-and-set SHALL be implemented once, in the shared helper, and `PeriodPrismaRepository.publishPeriod` — the sole surviving manual publish write path — MUST call it; no repository may carry its own inline copy of the manual guarded predicate or its zero-row classification. `PublicationPrismaRepository.saveAutoPublishedReport` deliberately does NOT call the helper: the scheduler path guards on a different, draft-keyed predicate (`status: "draft", archived: false`), and switching it onto the manual predicate would auto-publish a reopened period a head is actively editing.

#### Scenario: The manual publish path consumes the shared helper

- **GIVEN** the manual publish repository method (`publishPeriod`)
- **WHEN** its source is inspected
- **THEN** it obtains its transition outcome from the shared helper
- **AND** it does not re-declare the guarded predicate or the `count === 0` branch inline.

#### Scenario: The auto-publish predicate stays deliberately separate

- **WHEN** `saveAutoPublishedReport` is inspected
- **THEN** it guards on its own draft-keyed predicate and does not call the manual helper
- **AND** the divergence is documented at the helper's declaration

#### Scenario: No orphaned publish write path survives

- **WHEN** the publication repository's publish methods are enumerated
- **THEN** every one of them has a reachable production caller
- **AND** `publishAssembledReport` and its `PublishReportOutcome` type no longer exist

### Requirement: Canonical Guarded Predicate

The shared helper SHALL apply exactly the predicate
`{ id, periodStatus: { not: "published" }, archived: false }` to the report
`updateMany`. The `archived: false` clause MUST remain in the predicate — it is
the single point that closes the archive-versus-publish race, so a contradictory
archived-and-published row is never written.

#### Scenario: Only a not-yet-published, non-archived period transitions

- **GIVEN** a report row
- **WHEN** the helper runs its guarded `updateMany`
- **THEN** the row is matched only if it is not already `published` AND not
  `archived`
- **AND** an already-published or archived row matches zero rows.

### Requirement: Zero-Row Disambiguation Into Raced Versus Archived

When the guarded write matches zero rows, the helper SHALL re-read the row's
`periodStatus` to disambiguate: a now-`published` row MUST be reported as an
idempotent race (a concurrent publish won, this call wrote nothing); any other
state MUST be reported as archived (the period was archived inside the
read-to-write window — fail closed).

#### Scenario: Concurrent publish is reported as a race

- **GIVEN** two concurrent publishes that both clear the caller's fast-path
  already-published read
- **WHEN** the loser's guarded write matches zero rows and the re-read shows
  `periodStatus === "published"`
- **THEN** the helper reports the raced outcome and the caller treats it as an
  idempotent success without a second write.

#### Scenario: Archive inside the window fails closed

- **GIVEN** a period archived between the caller's read and the guarded write
- **WHEN** the guarded write matches zero rows and the re-read shows a
  non-published state
- **THEN** the helper reports the archived outcome and the caller does not
  publish.

### Requirement: Publish Gates Are Ordered Around The Already-Published Fast Return

`PeriodService.publishPeriod` SHALL order its pre-write gates so that the
archived denial runs BEFORE the already-published fast return, and the non-admin
active-period scope assert runs AFTER it. An archived period therefore fails
closed even when its `periodStatus` is already `published`, while a retry on an
already-published, non-archived period returns idempotent success without
consulting the active-period resolver. Denying that retry would report a scope
problem for a request that writes nothing and whose response echoes only the
caller's own `reportId`, on periods a head may already read.

#### Scenario: A retry on a no-longer-active published period stays an idempotent success

- **GIVEN** a non-admin head and an already-published, non-archived report that
  is NOT the active period
- **WHEN** the head publishes that report
- **THEN** the call returns idempotent success
- **AND** the active-period resolver is never consulted, so no scope denial is
  raised
- **AND** no guarded write and no post-publish side-effects run.

#### Scenario: An archived period is denied even when already published

- **GIVEN** an archived report whose `periodStatus` is already `published`
- **WHEN** it is published
- **THEN** the archived denial is raised and the already-published fast return
  is never reached
- **AND** no guarded write runs.

### Requirement: Injected Client Preserves Each Caller's Context And Snapshot Strategy

The helper SHALL accept the Prisma client (a transaction client or the base
client) AND the caller's full `data` field set as parameters, so the manual
caller keeps its transaction context and the helper remains independent of
snapshot assembly. The helper MUST apply that caller-supplied `data` inside the
SINGLE guarded `updateMany` statement and MUST NOT split any field out into a
separate write. `PeriodPrismaRepository.publishPeriod` runs the helper INSIDE a
`$transaction` and re-reads the written row through that same transaction
client before writing `publishedSnapshot`. The scheduler's
`PublicationPrismaRepository.saveAutoPublishedReport` is a separate, draft-keyed
compare-and-set path (`status: "draft", archived: false`); it does not call the
manual helper, but it likewise refreshes its snapshot inside its own transaction.
The snapshot re-read and write are each caller-owned second statements and do
not violate the helper's no-split rule, which governs only lifecycle `data`.

#### Scenario: Period repository runs the helper transactionally

- **GIVEN** `publishPeriod`
- **WHEN** it invokes the shared helper
- **THEN** the helper receives the transaction client and its guarded write and
  re-read execute inside that same `$transaction`, so the state write and the
  snapshot write remain atomic.

#### Scenario: The auto-publish repository keeps its own transaction

- **GIVEN** `PublicationPrismaRepository.saveAutoPublishedReport`
- **WHEN** it applies the auto-publish compare-and-set
- **THEN** its draft-keyed write and fresh snapshot re-read run through the same
  `$transaction` client, without invoking the manual helper, so the state write
  and snapshot write remain atomic.

### Requirement: Published Snapshot Is Built From A Fresh In-Transaction Re-Read

The immutable `publishedSnapshot` MUST be assembled from a report row re-read
INSIDE the same transaction as the guarded publish write, never from an
`AssembledReport` captured at an earlier, separate round-trip. This applies to
the manual `PeriodPrismaRepository.publishPeriod` path and the auto
`PublicationPrismaRepository.saveAutoPublishedReport` path. Each opens a
`$transaction`, uses its own guarded compare-and-set through the transaction
client, and — on a transitioning outcome — re-reads the row through that same
client to build the snapshot. A section edit committed by a lead between the
service's assemble-read and the publish write MUST therefore appear in the
frozen snapshot. The auto path keeps its own `status: "draft"` /
`archived: false` predicate and does NOT adopt the shared manual-publish helper;
only its snapshot's freshness and atomicity are shared.

#### Scenario: A concurrent section-save lands in the frozen snapshot

- **GIVEN** the publish service has already read the assembled report
- **WHEN** a lead commits a section edit before the guarded publish write runs
- **THEN** the publish transaction re-reads the row inside the transaction
- **AND** the frozen `publishedSnapshot` written by that transaction contains the
  lead's edit, not the pre-edit state.

#### Scenario: The returned report matches the frozen snapshot

- **GIVEN** either publish repository path transitions a report to published
- **WHEN** it builds the `AssembledReport` it returns to the caller
- **THEN** that report is built from the SAME in-transaction re-read used to
  build the snapshot, so the frozen snapshot and the returned report are never a
  torn read.

#### Scenario: Auto-publish keeps its draft-scoped predicate

- **GIVEN** `PublicationPrismaRepository.saveAutoPublishedReport`
- **WHEN** the fresh-snapshot transaction is applied
- **THEN** its compare-and-set predicate remains `status: "draft"` /
  `archived: false`
- **AND** it still does not call the shared manual-publish helper.

### Requirement: Dedup Is Behavior-Preserving And Scope-Bounded

This change SHALL NOT alter any observable publish behavior, the period-dual-state
single-transition-writer invariant, or the lifecycle field set (which continues
to come from the transition builder). The existing publish-atomicity integration
test MUST continue to pass unchanged. `saveAutoPublishedReport`, whose predicate
is `status: "draft"`, is a DIFFERENT compare-and-set and MUST remain out of
scope.

#### Scenario: Atomicity test still gates the extracted helper

- **GIVEN** the extracted shared helper in use by both repositories
- **WHEN** `period.publish-atomicity.integration.test.ts` runs against real
  Postgres
- **THEN** exactly one of two concurrent publishes transitions the row and
  rebuilds the snapshot, exactly as before the extraction.

#### Scenario: Auto-publish CAS is untouched

- **GIVEN** `PublicationPrismaRepository.saveAutoPublishedReport`
- **WHEN** this change is applied
- **THEN** its `status: "draft"` predicate is unchanged and it does not call the
  manual-publish helper.

### Requirement: Post-publish side-effects are emitted from one module

Post-publish side-effects (the telemetry pair and analytics-cache invalidation)
MUST be emitted through one shared module in the period application layer;
publish-capable services MUST NOT carry a private copy of the emission
discipline, and side-effects MUST fire only after a real state transition
(never on raced, archived, or skipped outcomes). Publish-time ingestion MUST
NOT be required, invoked, or represented by a no-op collaborator in the current
MVP.

#### Scenario: Manual and auto publish share the emission seam

- **WHEN** a head publishes via `period.publish` or the scheduler auto-publishes a candidate
- **THEN** both paths emit telemetry and invalidate the analytics cache through
  the same module
- **AND** a redundant or raced publish emits nothing

#### Scenario: Post-commit side-effect degradation never breaks publish

- **WHEN** telemetry or analytics-cache invalidation fails after a successful
  publish transition
- **THEN** the publish still succeeds
- **AND** the failed side effect is reported without preventing the independent
  side effect from running

#### Scenario: Publishing has no ingestion dependency

- **WHEN** manual or automatic publishing runs
- **THEN** it succeeds because the current MVP does not invoke an ingestion path

#### Scenario: Production composition has no ingestion dependency

- **WHEN** the API modules resolve under `NODE_ENV=production` with the required
  product configuration
- **THEN** manual and automatic publishing resolve without an ingestion queue,
  hook, or no-op adapter
- **AND** no publish path reads report-section identifiers solely for ingestion

### Requirement: There is exactly one manual publish entry point

The tRPC surface MUST expose exactly one manual publish mutation (`period.publish`); the system MUST NOT keep a second head-facing publish procedure without a product consumer.

#### Scenario: A head publishes from any surface

- **WHEN** any head UI surface triggers publishing
- **THEN** the request goes through `period.publish`
- **AND** no `review.publish` procedure exists on the router

### Requirement: Auto-publish outcomes distinguish no-write idempotency from a real write

`PublicationService.publishAuto` MUST report a `published: true` outcome that
lets its caller distinguish two cases: (a) the report was already
`status === "published"` when read, so no write occurred, versus (b) this
call performed the guarded write that transitioned the report to published.
`AutoPublisherScheduler.runOnce` MUST use that distinction to suppress its
audit log (`auditLogger.periodAutoPublish`), its info log line, and the
missing-sections count query on case (a), so a manual publish that races
ahead of the scheduler is never recorded as an auto-publish audit event.

#### Scenario: Idempotent already-published outcome is not audited

- **GIVEN** a report that is already `status === "published"` when
  `publishAuto` reads it (a manual publish won the race)
- **WHEN** `publishAuto` returns its idempotent outcome
- **THEN** the scheduler does not call `auditLogger.periodAutoPublish`
- **AND** the scheduler does not log an `auto-publish period=...` line
- **AND** the scheduler does not query the missing-sections count
- **AND** the report's id is excluded from the scheduler's `publishedIds`.

#### Scenario: A real auto-publish write is still audited

- **GIVEN** a draft report whose deadline plus grace period has passed
- **WHEN** `publishAuto` performs the guarded compare-and-set write and it
  succeeds
- **THEN** the scheduler calls `auditLogger.periodAutoPublish` exactly once
  for that report
- **AND** the report's id appears in the scheduler's `publishedIds`.

#### Scenario: The archived-after-selection branch is unaffected

- **GIVEN** a period archived between candidate selection and the guarded
  write, so `publishAuto` returns `{ published: false }`
- **WHEN** the scheduler processes that outcome
- **THEN** it continues to skip the audit, log, and missing-sections count
  exactly as before this change.
