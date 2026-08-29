## ADDED Requirements

### Requirement: Arbitrary editable period ranges cannot overlap under concurrency

The period-admin create and update tRPC paths MUST serialize the overlap
decision so that two distinct editable `scheduled` or `open` date ranges that
overlap cannot both commit. Exact-boundary uniqueness alone MUST NOT establish
this invariant. Published and archived rows MUST remain outside the database
range constraint because legitimate republish history can share a period
envelope; their date envelopes remain frozen until the lifecycle is made
editable again.

#### Scenario: Concurrent overlapping creates

- **WHEN** two authorized requests concurrently create different but
  overlapping period ranges
- **THEN** at most one range commits
- **AND** the losing request returns the canonical typed overlap conflict
  without report or reminder side effects

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
