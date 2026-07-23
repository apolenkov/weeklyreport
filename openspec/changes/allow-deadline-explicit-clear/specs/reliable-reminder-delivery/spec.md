## ADDED Requirements

### Requirement: A cleared deadline silences the period's reminder automation

A period whose `deadline` was explicitly cleared (ruling F16,
`allow-deadline-explicit-clear`) has no reference point for deadline-relative
automation. The due-rule dispatch queries are the enforcing mechanism: rules
belonging to a deadline-less report MUST never be returned as due, even when
the rules materialized before the clear. New rules are never materialized for
a deadline-less period (the policy applicator is skipped at create/restore).
The submit deadline gate MUST treat a null deadline as an explicit skip —
`late` stays false, nothing throws, and the skip is logged with the report id
so a missing late stamp is always traceable.

#### Scenario: Materialized rules stop dispatching after a clear

- **GIVEN** an active deadline (or escalation) rule whose `fireAt` has passed
- **WHEN** the admin clears the report's deadline and the dispatch query runs
- **THEN** the query returns no due entry for that rule

#### Scenario: Submissions to a deadline-less period are never late

- **GIVEN** a period whose deadline was cleared, with any grace settings —
  including `allowLateSubmissions: false`
- **WHEN** a lead submits a section at any wall-clock time
- **THEN** the submit succeeds with `late: false`
- **AND** the skip is logged at info with the report id
