## Purpose

Protect report lifecycle data from destructive races by making administrative deletion an atomic, lifecycle-aware operation.

## ADDED Requirements

### Requirement: Report deletion is lifecycle-guarded atomically

The administrative report-delete tRPC procedure MUST delete a `Report` and its permitted children only when the same atomic database operation proves that the report is still deletable. A published or archived report MUST NOT be deleted, including when its lifecycle changes concurrently with the request.

#### Scenario: Draft report is deleted

- **WHEN** an authorized administrator deletes a report that remains in a deletable draft lifecycle state
- **THEN** exactly one delete succeeds and the permitted dependent rows are removed consistently

#### Scenario: Publish wins the race

- **WHEN** publication commits after an initial read but before the delete writer acquires its guard
- **THEN** deletion fails with the canonical typed lifecycle outcome
- **AND** the report and all dependent rows remain intact

#### Scenario: Two deletes race

- **WHEN** two authorized delete requests target the same deletable report concurrently
- **THEN** at most one request reports success
