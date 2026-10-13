## MODIFIED Requirements

### Requirement: Every group-scoped repository uses the canonical filter

Telemetry, review, weekly-report portfolio, reminders, activity, and lifecycle
repositories MUST use `groupScopeFilter` or `guardGroupScope` rather than
reimplementing role and group expansion. `guardGroupScope` MUST reject a missing
session, including `undefined` and `null`, before query construction.

#### Scenario: A new group-scoped read is added

- **WHEN** a repository adds a read whose records belong to reporting groups
- **THEN** it derives the filter from the authenticated session through the canonical scope API
- **AND** it does not maintain a second role-to-group implementation

#### Scenario: A scope session is absent

- **WHEN** a repository passes `undefined` or `null` to `guardGroupScope`
- **THEN** the guard rejects with the explicit missing-scope-session diagnostic
- **AND** query construction does not proceed
