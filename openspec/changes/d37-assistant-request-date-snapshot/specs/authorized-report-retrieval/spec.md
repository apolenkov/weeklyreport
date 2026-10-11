## ADDED Requirements

### Requirement: One assistant request uses one trusted server date

The `leadForm.assistant` procedure MUST capture one trusted server instant at
the start of assistant execution. Planner date, report-period selection,
Decision filters and grounded Decision aggregates MUST use that same instant
and server timezone throughout the request. A later request MUST capture its
own current instant.

#### Scenario: Midnight passes after exact Decision filtering

- **GIVEN** a request selects an open Decision with `due_today` timing
- **WHEN** semantic retrieval completes after midnight in the server timezone
- **THEN** the grounded Decision timing remains `due_today` for that request
- **AND** its aggregates remain consistent with the exact filter

#### Scenario: A later request sees the new calendar date

- **GIVEN** an unresolved Decision was due on the previous server calendar date
- **WHEN** a new assistant request starts after midnight
- **THEN** its planner and Decision classification use the new date
- **AND** the Decision is classified as `overdue`
