## ADDED Requirements

### Requirement: Published Snapshot Is Built From A Fresh In-Transaction Re-Read

The immutable `publishedSnapshot` MUST be assembled from a report row re-read
INSIDE the same transaction as the guarded publish write, never from an
`AssembledReport` captured at an earlier, separate round-trip. This applies to
both publish repository paths:
`PublicationPrismaRepository.publishAssembledReport` (manual publish) and
`PublicationPrismaRepository.saveAutoPublishedReport` (auto publish). Each opens
a `$transaction`, runs its guarded compare-and-set through the transaction
client, and — on a transitioning outcome — re-reads the row through that same
client to build the snapshot. A section edit committed by a lead between the
service's assemble-read and the publish write MUST therefore appear in the frozen
snapshot. The auto path keeps its own `status: "draft"` / `archived: false`
compare-and-set predicate and does NOT adopt the shared manual-publish helper;
only its snapshot's freshness and atomicity change.

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

## MODIFIED Requirements

### Requirement: Injected Client Preserves Each Caller's Context And Snapshot Strategy

The helper SHALL accept the Prisma client (a transaction client or the base
client) AND the caller's full `data` field set as parameters, so each caller
keeps its existing execution context and one helper can serve two callers with
different field sets. The helper MUST apply that caller-supplied `data` inside
the SINGLE guarded `updateMany` statement and MUST NOT split any field out into a
separate write. After this change BOTH manual publishers converge on the same
transactional strategy: `PublicationPrismaRepository.publishAssembledReport` and
`PeriodPrismaRepository.publishPeriod` each run the helper INSIDE a
`$transaction`, deriving atomicity from the transaction and building the
`publishedSnapshot` from a written-back row re-read through that same transaction
client. That snapshot re-read and its write are the caller's OWN second
in-transaction statement — this does not violate the "MUST NOT split" rule, which
governs only the helper's handling of the lifecycle `data`. The helper never
BUILDS or SOURCES the snapshot — each caller composes its own lifecycle `data`
and writes its own snapshot; "does not own snapshot writing" means exactly that.

#### Scenario: Period repository runs the helper transactionally

- **GIVEN** `publishPeriod`
- **WHEN** it invokes the shared helper
- **THEN** the helper receives the transaction client and its guarded write and
  re-read execute inside that same `$transaction`, so the state write and the
  snapshot write remain atomic.

#### Scenario: Publication repository runs the helper transactionally

- **GIVEN** `PublicationPrismaRepository.publishAssembledReport`
- **WHEN** it invokes the shared helper
- **THEN** the helper receives the transaction client, its guarded write and
  zero-row re-read execute inside that same `$transaction`, and the caller then
  re-reads the written-back row through the same client to build the
  `publishedSnapshot` and write it as a second in-transaction statement — so the
  state write and the snapshot write remain atomic and the snapshot reflects the
  latest committed state.
