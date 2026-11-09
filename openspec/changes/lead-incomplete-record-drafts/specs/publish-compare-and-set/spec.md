## MODIFIED Requirements

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

The same publication-state projection MUST exclude incomplete risks and decisions before deriving statuses, aggregates and frozen record contents, and MUST freeze omission metadata from that state. Complete records in unsubmitted sections remain included. This exclusion does not change either publish path’s existing eligibility or predicates.

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

#### Scenario: Mixed sections on manual or automatic publication

- **GIVEN** an otherwise eligible report contains a submitted section and an unsubmitted section with a complete decision and an incomplete blocked risk
- **WHEN** either manual or automatic publication transitions the report
- **THEN** the snapshot retains both sections and the complete decision, excludes the incomplete risk before deriving statuses and aggregates, and freezes its scoped omission count
- **AND** the incomplete risk does not impose a status floor

#### Scenario: Reopening and republishing recomputes the projection

- **GIVEN** a published snapshot with frozen omission metadata and an authorized reopening
- **WHEN** the period is edited and republished
- **THEN** the prior frozen representation is not mutated and the new snapshot reflects the new publication state and omission counts

## ADDED Requirements

### Requirement: Publication serializes complete projection with section writes

Both publication paths MUST serialize the source graph read, lifecycle CAS, snapshot, omission metadata and frozen projection replacement against section writes. A save committed before publication wins serialization MUST be reflected; a save after publication MUST fail its lifecycle gate. A repeatable-read snapshot taken before a waiting save finishes MUST NOT silently freeze stale child rows.

#### Scenario: Save commits while automatic publish waits

- **WHEN** a section save holds the shared write lane and automatic publication waits for it
- **THEN** automatic publication reads the committed section state after obtaining serialization, or aborts and retries the complete transaction with a fresh snapshot
- **AND** its frozen complete rows and omission counts describe that same state

#### Scenario: Publication wins before draft completion

- **WHEN** publication wins serialization before a request completing an incomplete draft
- **THEN** that publication excludes the row and records its omission, and the subsequent save fails without changing retained text
- **AND** author recovery remains available subject to its existing entitlement
