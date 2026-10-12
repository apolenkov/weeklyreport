## MODIFIED Requirements

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

#### Scenario: Published or archived envelope remains frozen in the editor

- **WHEN** the administrator edits a published or archived period
- **THEN** date/deadline controls retain their values and remain disabled with an explanation, while label editing and submission remain available
- **AND** a label submission preserves the exact original date instants and nullable deadline instead of roundtripping through date/time inputs
