## RENAMED Requirements

- FROM: `### Requirement: Audit Documents Every Caller of the Guarded Methods`
- TO: `### Requirement: Every Caller of Guarded Methods Must Pass a Valid Group Scope`

## MODIFIED Requirements

### Requirement: Every Caller of Guarded Methods Must Pass a Valid Group Scope

Callers of `findDraftSections`, `findReports`, and period queries MUST supply
a non-null `groupScope` from the authenticated session context. Callers MUST
NOT bypass the scope guard by passing a null or empty scope with the expectation
that the query returns zero rows.

#### Scenario: New procedure added that calls a guarded method

- **WHEN** a developer adds a new tRPC procedure that calls `findReports`
- **THEN** the procedure MUST pass `groupScope` from `ctx` into the repository call
- **AND** a code review or CI check MUST flag the absence of `groupScope` as a violation
