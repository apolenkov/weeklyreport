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

- **GIVEN** a P2002 carrying the scoped unique-constraint identity
- **WHEN** `isUniqueViolation` is called scoped to
  a named unique constraint (or its column set)
- **THEN** it returns `true` and the caller maps it to the friendly overlap error.

#### Scenario: Scoped guard re-throws an unrelated unique violation

- **GIVEN** a P2002 raised by a different unique constraint than the scope names
- **WHEN** the scoped `isUniqueViolation` inspects it
- **THEN** it returns `false`
- **AND** the caller re-throws the original error, so an unrelated unique
  violation is never masked as the scoped domain error.

### Requirement: Matcher Is Proven By A Real-Database Integration Test

The integration suite MUST run against a real Postgres through the pg driver
adapter, provoke an actual P2002 rather than a hand-built mock, and assert that
the shared guard returns `true` for that live error. The test MUST fail
if the guard reverts to a `meta.target`-only match, because the adapter leaves
`meta.target` unset.

#### Scenario: Live duplicate insert is classified by the guard

- **GIVEN** a real `_test` Postgres and a table with a unique constraint
- **WHEN** a duplicate row insert raises a genuine P2002 through the adapter
- **THEN** the test asserts `isUniqueViolation` returns `true` for the caught
  error
- **AND** the test asserts the caught error's `meta.target` is unset, pinning
  the reason a `meta.target`-only guard would silently miss it.

### Requirement: Production detectors use the shared guard

Every non-test P2002 detector MUST call the shared guard, leaving no bare
`"P2002"` literal in production code. `ensure-lead-section`, `user-session`, and
the reminders dedupe path MUST use constraint-aware matching. `carry-over` and
`policy-applicator` intentionally accept any P2002 and MUST call the unscoped
guard so their swallow-any-unique-violation contract remains explicit.

#### Scenario: Concurrent first-login race resolves through the shared guard

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
