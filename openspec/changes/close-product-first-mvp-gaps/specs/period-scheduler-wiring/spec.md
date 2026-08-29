## ADDED Requirements

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

### Requirement: Current-period lookup selects only a coupled live tuple

The login-time and scheduler current-period factory MUST select an existing
report only when legacy status is draft, archived is false, canonical state is
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
