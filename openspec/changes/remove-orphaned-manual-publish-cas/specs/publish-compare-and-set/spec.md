## MODIFIED Requirements

### Requirement: Single Shared Publish Compare-And-Set Helper

The publish compare-and-set SHALL be implemented once, in a shared helper, and both live publish write paths — `PeriodPrismaRepository.publishPeriod` (manual, via `period.publish`) and `PublicationPrismaRepository.saveAutoPublishedReport` (scheduler auto-publish) — MUST call it. Neither repository may carry its own inline copy of the guarded predicate or the zero-row classification, and the repository MUST NOT retain publish write methods with no production caller.

#### Scenario: Both publish repositories consume the shared helper

- **GIVEN** the two live publish repository methods
- **WHEN** their source is inspected
- **THEN** each obtains its transition outcome from the shared helper
- **AND** neither re-declares the guarded predicate or the `count === 0` branch
  inline.

#### Scenario: No orphaned publish write path survives

- **WHEN** the publication repository's publish methods are enumerated
- **THEN** every one of them has a reachable production caller
- **AND** `publishAssembledReport` and its `PublishReportOutcome` type no longer exist
