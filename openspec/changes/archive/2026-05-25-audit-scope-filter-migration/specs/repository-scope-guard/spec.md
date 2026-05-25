## ADDED Requirements

### Requirement: Repository Read Methods Enforce Group Scope Defensively

Prisma repository read methods MUST assert that a non-null `groupScope`
is present in the call context before executing the query. This applies
to `findDraftSections`, `findReports`, and period queries. The assertion
MUST be at the repository layer so that an upstream middleware
regression cannot silently widen the data set returned to a caller.

#### Scenario: Caller supplies a valid group scope

- **WHEN** a tRPC procedure passes `groupScope.productIds = [<uuid>...]` into the repository
- **THEN** the query executes and returns rows restricted to those product ids

#### Scenario: Caller forgets to pass a group scope

- **WHEN** a tRPC procedure calls the repository without a `groupScope`
- **THEN** the repository raises a `ScopeGuardError` BEFORE executing the query
- **AND** no rows are read or returned

#### Scenario: Caller passes an empty group scope

- **WHEN** a tRPC procedure calls the repository with `groupScope.productIds = []`
- **THEN** the repository raises a `ScopeGuardError`
- **AND** the caller MUST explicitly handle the empty-scope case upstream rather than leaning on the repository to return zero rows

### Requirement: Audit Documents Every Caller of the Guarded Methods

The change MUST produce an audit document listing every tRPC procedure
that calls `findDraftSections`, `findReports`, or period queries, the
middleware chain each procedure uses, and whether the upstream scope
guard is present. Unguarded paths MUST be either fixed or explicitly
justified.

#### Scenario: Reviewer inspects the audit document

- **WHEN** a reviewer opens the audit document produced by this change
- **THEN** the document lists every consumer of the guarded methods with file and line refs
- **AND** every entry is annotated as either `guarded`, `fixed`, or `justified`

### Requirement: Regression Test Covers Unauthorized Group Access

A regression test MUST construct a user authenticated for group A and
attempt to read reports / sections from group B. The test MUST assert
that the request is rejected at the API boundary (typically `403`) and
that no group-B data is returned.

#### Scenario: User from group A queries group B

- **WHEN** the regression test calls a tRPC procedure for group B reports while authenticated as a group-A user
- **THEN** the call rejects with a 403-equivalent error
- **AND** the response contains no rows from group B
