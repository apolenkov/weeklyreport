## MODIFIED Requirements

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
