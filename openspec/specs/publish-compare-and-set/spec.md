# publish-compare-and-set Specification

## Purpose

TBD - created by archiving change api-shared-guards. Update Purpose after archive.

## Requirements

### Requirement: Single Shared Publish Compare-And-Set Helper

The manual-publish compare-and-set SHALL be implemented once, in a shared
helper, and both `PeriodPrismaRepository.publishPeriod` and
`PublicationPrismaRepository.publishAssembledReport` MUST call it. Neither repository may carry
its own inline copy of the guarded predicate or the zero-row classification
after this change.

#### Scenario: Both publish repositories consume the shared helper

- **GIVEN** the two manual-publish repository methods
- **WHEN** their source is inspected
- **THEN** each obtains its transition outcome from the shared helper
- **AND** neither re-declares the guarded predicate or the `count === 0` branch
  inline.

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

### Requirement: Injected Client Preserves Each Caller's Context And Snapshot Strategy

The helper SHALL accept the Prisma client (a transaction client or the base
client) AND the caller's full `data` field set as parameters, so each caller
keeps its existing execution context and one helper can serve two callers with
different field sets. The helper MUST apply that caller-supplied `data` inside
the SINGLE guarded `updateMany` statement and MUST NOT split any field out into a
separate write. Because `PublicationPrismaRepository.publishAssembledReport` runs
with no surrounding transaction, its `publishedSnapshot` (built from the
in-memory assembled report) MUST remain a field INSIDE that one guarded
`updateMany` `data` — single-statement execution is its only atomicity.
`PeriodPrismaRepository.publishPeriod` MUST keep running the helper inside its
`$transaction`, deriving atomicity from the transaction and building its snapshot
from the written-back row within it. The helper never BUILDS or SOURCES the
snapshot — each caller composes its own `data`; "does not own snapshot writing"
means exactly that, NOT that the snapshot becomes a separate statement.

#### Scenario: Period repository runs the helper transactionally

- **GIVEN** `publishPeriod`
- **WHEN** it invokes the shared helper
- **THEN** the helper receives the transaction client and its guarded write and
  re-read execute inside that same `$transaction`, so the state write and the
  snapshot write remain atomic.

#### Scenario: Publication repository runs the helper without a transaction

- **GIVEN** `PublicationPrismaRepository.publishAssembledReport`
- **WHEN** it invokes the shared helper
- **THEN** the helper receives the base client and the caller's `data` field set
  carrying its in-memory-assembled `publishedSnapshot`, and that snapshot is
  written INSIDE the single guarded `updateMany` — not as a separate statement —
  so the state and snapshot stay atomic without a surrounding transaction.

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
