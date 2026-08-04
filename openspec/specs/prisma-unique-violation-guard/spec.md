# prisma-unique-violation-guard Specification

## Purpose

Centralize Prisma unique-violation detection in one constraint-aware guard that understands the pg adapter shape and is proved against a real database.

## Requirements

### Requirement: Single Source For The Unique-Violation Error Code

The api SHALL expose exactly one exported `PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE`
constant (value `"P2002"`), and all unique-violation detection MUST compare
against that constant rather than an inline `"P2002"` string literal.

#### Scenario: No inline P2002 literals remain in detection paths

- **GIVEN** the api source tree
- **WHEN** unique-violation detection code is inspected
- **THEN** every guard references the shared constant
- **AND** no non-test detection site compares `error.code` to a bare `"P2002"`
  string literal.

### Requirement: Guard Matches The pg-Adapter Error Shape, Not meta.target Alone

The shared `isUniqueViolation` guard SHALL identify a P2002 using a shape that
survives the pg driver adapter, where a real violation leaves `meta.target`
UNSET. The guard MUST derive identity from the serialized `meta` object AND the
top-level `message`, and MUST NOT depend on `meta.target` being populated.

#### Scenario: Real pg-adapter P2002 with unset meta.target is detected

- **GIVEN** a `PrismaClientKnownRequestError` whose `code` is the shared
  constant and whose `meta.target` is `undefined`, carrying the constraint
  identity only in `meta.driverAdapterError.cause.originalMessage` / the
  top-level `message`
- **WHEN** `isUniqueViolation` inspects it
- **THEN** it returns `true`.

#### Scenario: Non-P2002 error is rejected

- **GIVEN** an error whose `code` is not the shared unique-constraint code
- **WHEN** `isUniqueViolation` inspects it
- **THEN** it returns `false`
- **AND** the caller re-throws the error unchanged.

### Requirement: Scoped Match Discriminates The Target Constraint

The guard SHALL accept an optional scope naming a constraint index and/or its
column set. When a scope is supplied, `isUniqueViolation` MUST return `true`
only for a P2002 whose identity matches that index name OR that column pair, and
MUST return `false` for a P2002 raised by a DIFFERENT unique constraint so the
caller re-throws it. When no scope is supplied, any P2002 matches.

#### Scenario: Scoped guard accepts its own constraint

- **GIVEN** a P2002 carrying the open-boundary index identity
- **WHEN** `isUniqueViolation` is called scoped to
  `Report_one_open_per_boundary` (or its `periodStart`+`periodEnd` columns)
- **THEN** it returns `true` and the caller maps it to the friendly overlap error.

#### Scenario: Scoped guard re-throws an unrelated unique violation

- **GIVEN** a P2002 raised by a different unique constraint than the scope names
- **WHEN** the scoped `isUniqueViolation` inspects it
- **THEN** it returns `false`
- **AND** the caller re-throws the original error, so an unrelated unique
  violation is never masked as the scoped domain error.

### Requirement: Matcher Is Proven By A Real-Database Integration Test

This change SHALL add an integration test that runs against a real Postgres via
the pg driver adapter, provokes an ACTUAL P2002 (not a hand-built mock), and
asserts the shared guard returns `true` for that live error. The test MUST fail
if the guard reverts to a `meta.target`-only match, because the adapter leaves
`meta.target` unset.

#### Scenario: Live duplicate insert is classified by the guard

- **GIVEN** a real `_test` Postgres and a table with a unique constraint
- **WHEN** a duplicate row insert raises a genuine P2002 through the adapter
- **THEN** the test asserts `isUniqueViolation` returns `true` for the caught
  error
- **AND** the test asserts the caught error's `meta.target` is unset, pinning
  the reason a `meta.target`-only guard would silently miss it.

### Requirement: Ad-Hoc Detectors Consolidate Onto The Shared Guard

ALL existing inline P2002 detectors SHALL be replaced by calls to the shared
guard, leaving no bare `"P2002"` literal in non-test code. Adoption is
behavior-preserving at every site EXCEPT the two that currently test
`meta.target` only (`ensure-lead-section`, `user-session`), which MUST adopt the
pg-adapter-correct shape; that is a behavior fix, since under the adapter those
guards previously returned `false` and let the concurrent-login race surface as a
raw error instead of resolving to the race winner. The already-correct second
copy (reminders' `isDedupeKeyConflict`) folds onto the guard scoped to its
`dedupeKey` constraint; the two bare `code === "P2002"` swallow-sites
(`carry-over`, `policy-applicator`) fold onto the UNSCOPED guard, preserving
their current swallow-any-P2002 behavior — scoping them would newly re-throw an
unrelated P2002 and is therefore out of scope.

#### Scenario: Concurrent first-login race resolves after adoption

- **GIVEN** two concurrent first-logins of the same user under the pg adapter,
  where the loser's create raises a P2002 with unset `meta.target`
- **WHEN** the loser's create is caught by the shared guard
- **THEN** the guard returns `true`, the loser re-reads and returns the winner's
  row, and no error propagates to the caller.

### Requirement: Scoped Match Uses Identity-Boundary Matching, Not Bare Substring

The scoped match in `isUniqueViolation` MUST NOT rely on bare substring
containment (`identity.includes(...)`) alone to compare a scope's `index`
name or `columns` entries against the serialized error identity. It MUST use
a boundary-aware comparison (e.g. matching the identifier surrounded by
non-identifier characters, or matching the quoted form the database/driver
actually emits) so that one constraint or column name being a textual
substring of an unrelated identifier cannot cause a false match.

#### Scenario: A substring collision does not cause a false match

- **GIVEN** a P2002 whose identity string contains an unrelated constraint
  name that happens to contain a scope's `index` or a `columns` entry as a
  substring
- **WHEN** the scoped `isUniqueViolation` inspects it
- **THEN** it returns `false`
- **AND** the caller re-throws the original error, exactly as it would for
  any other unrelated P2002
