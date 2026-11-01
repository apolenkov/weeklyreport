# repository-scope-guard Specification

## Purpose

Define the canonical group-scope filter that prevents authenticated Prisma
reads from returning cross-group data. Repository consumers derive a target-
specific Prisma `where` fragment from the current session and fail closed to an
empty result when the caller has no allowed groups.

Consumer surface: `apps/api/src/lib/group-scope.ts` — `groupScopeFilter` and
`guardGroupScope`; group-scoped repositories under `apps/api/src/modules/`.

## Requirements

### Requirement: The canonical filter derives scope from the authenticated session

Group-scoped Prisma reads MUST call `groupScopeFilter(session, target)` with
the authenticated session and the appropriate `user`, `reportSection`, or
`project` target. A non-admin caller with allowed groups receives a Prisma
filter restricted to those group ids. An admin receives the unrestricted `{}`
filter by product decision.

#### Scenario: Caller has an allowed group

- **WHEN** a repository derives a target filter for a session allowed to access group A
- **THEN** the query executes with the target's group relation restricted to group A
- **AND** it cannot return group-B rows

#### Scenario: Caller has no allowed groups

- **WHEN** `groupScopeFilter` receives an authenticated non-admin session whose allowed-group set is empty
- **THEN** it returns the canonical deny-all filter `{ id: { in: [] } }`
- **AND** the repository returns zero rows without widening access

#### Scenario: Admin uses the same filter API

- **WHEN** `groupScopeFilter` receives an admin session
- **THEN** it returns `{}` for every supported target

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

### Requirement: Regression Test Covers Unauthorized Group Access

A regression test MUST construct a user authenticated for group A and attempt
to read reports or sections from group B. The target-specific contract MAY
either reject direct access at the API boundary or return an empty scoped list,
but MUST return no group-B data.

#### Scenario: User from group A queries group B

- **WHEN** the regression test calls a tRPC procedure for group B reports while authenticated as a group-A user
- **THEN** the call rejects with a 403-equivalent error or returns an empty scoped result
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
