# repository-scope-guard Specification

## Purpose

Define the defensive scope-guard invariant that prevents Prisma repository
read methods from returning cross-group data when upstream middleware
regresses. Ensures that every read of `findDraftSections`, `findReports`,
and period queries is bounded to the caller's authorised product group.

Consumer surfaces: `findDraftSections`, `findReports`, and period query
methods in `apps/api/src/modules/` repositories; `ScopeGuardError` type;
tRPC procedures that call these methods.

## Requirements

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

### Requirement: Every Caller of Guarded Methods Must Pass a Valid Group Scope

Callers of `findDraftSections`, `findReports`, and period queries MUST supply
a non-null `groupScope` from the authenticated session context. Callers MUST
NOT bypass the scope guard by passing a null or empty scope with the expectation
that the query returns zero rows.

#### Scenario: New procedure added that calls a guarded method

- **WHEN** a developer adds a new tRPC procedure that calls `findReports`
- **THEN** the procedure MUST pass `groupScope` from `ctx` into the repository call
- **AND** a code review or CI check MUST flag the absence of `groupScope` as a violation

### Requirement: Regression Test Covers Unauthorized Group Access

A regression test MUST construct a user authenticated for group A and
attempt to read reports / sections from group B. The test MUST assert
that the request is rejected at the API boundary (typically `403`) and
that no group-B data is returned.

#### Scenario: User from group A queries group B

- **WHEN** the regression test calls a tRPC procedure for group B reports while authenticated as a group-A user
- **THEN** the call rejects with a 403-equivalent error
- **AND** the response contains no rows from group B

### Requirement: Head Cross-Author Lead-Form Reads Enforce Group Scope

A head-role read of another author's lead-form section MUST be bounded to the
head's own reporting group before the target section is returned, even when the
target author is supplied by the client (`requestedAuthorId`) and resolved by
author-keyed `findUnique` rather than a guarded list method. The
service MUST assert the target author's reporting group is within the head's
allowed group ids (equivalently, `groupScopeFilter(session, "reportSection")`)
and MUST reject a cross-group target with a 403-equivalent access error,
returning no section rows. The `admin` role is exempt and reads
unconditionally.

#### Scenario: Head requests a section in another reporting group

- **WHEN** a head calls the by-period lead-form read with a `requestedAuthorId`
  whose author belongs to a different reporting group
- **THEN** the request is rejected with a 403-equivalent access error
- **AND** no section rows for the other group's author are returned

#### Scenario: Head requests a section in its own reporting group

- **WHEN** a head calls the by-period lead-form read with a `requestedAuthorId`
  whose author belongs to the head's own reporting group
- **THEN** the target author's full section is returned

#### Scenario: Admin requests any author's section

- **WHEN** an admin calls the by-period lead-form read with any
  `requestedAuthorId`
- **THEN** the group scope is not applied and the target author's full section
  is returned

### Requirement: Regression Test Covers Archive Cross-Group Section Isolation

The archive repository's group-scoped section filter MUST have regression
test coverage proving that a lead or head session scoped to one reporting
group reads only that group's sections from a report whose sections span
multiple groups on the immutable publication-snapshot read path. Archived
reports without a persisted publication snapshot MUST fail closed; they must
not be reconstructed from mutable draft records.

#### Scenario: scoped session reads only its group's sections from a published snapshot

- **GIVEN** a published, archived report whose sections span reporting group
  A and reporting group B, with a persisted `publishedSnapshot`
- **WHEN** the archive repository is called with a session scoped to group A
- **THEN** the returned sections and recomputed `portfolioOverview` reflect
  only group A's records, with no group-B data present

#### Scenario: archived report without a publication snapshot is rejected

- **GIVEN** a published, archived report whose sections span reporting group
  A and reporting group B, with no persisted `publishedSnapshot`
- **WHEN** the archive repository is called with any session
- **THEN** the read fails closed instead of loading mutable draft records

#### Scenario: the filter is symmetric across groups

- **GIVEN** the same multi-group report as above
- **WHEN** the archive repository is called with a session scoped to group B
  instead of group A
- **THEN** the returned sections and `portfolioOverview` reflect only group
  B's records
