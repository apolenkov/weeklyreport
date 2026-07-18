## ADDED Requirements

### Requirement: API tests and their subject doc comments MUST be able to fail for the behavior they name

Every test in `apps/api` MUST assert on the specific behavior its title or
comment claims to verify, such that a regression in that behavior makes the
test fail. A test whose assertions pass regardless of the named behavior
(e.g. checking element presence via `toContain` when the claim is about
order, or probing keys a return type structurally never carries) is a
defect, not a passing test. Doc comments (JSDoc/docstrings) on a function
MUST describe what the function's code actually does; a comment stating the
opposite of the executed branch MUST be corrected to match the code, not the
other way around, unless the code itself is the confirmed bug.

#### Scenario: A guard test asserts a hardcoded count instead of deriving it

- **WHEN** a test exists to guard that every class in a mapping table has a
  corresponding test case (e.g. `trpc.error-mapper.test.ts`'s domain-error
  coverage guard)
- **THEN** the guard derives its expected set from the source table itself
  (e.g. `DOMAIN_ERROR_CODES`), not a hand-maintained literal count
- **AND** adding a class to the table without a corresponding test case makes
  the guard fail

#### Scenario: A test title claims an ordering property

- **WHEN** a test's title or leading comment claims output is sorted,
  ordered, or otherwise sequenced in a specific way
- **THEN** the test asserts the actual relative order of the elements (not
  merely their presence)
- **AND** if the code does not yet implement the claimed order, either the
  code is fixed to implement it or the test/title is corrected to state only
  what the code does

#### Scenario: A function's doc comment contradicts its own executed branch

- **WHEN** a function's header doc comment states a specific behavior for an
  input class (e.g. "a malformed cursor returns X" or "a null field is
  kept")
- **AND** the function's code takes a different, confirmed-correct branch
  for that same input class (e.g. throws, or drops the field)
- **THEN** the doc comment is rewritten to match the code's actual, correct
  behavior

#### Scenario: A reorder/identity test cannot distinguish the claimed mechanism

- **WHEN** a test claims to prove a rendering or reconciliation property
  (e.g. that composite keys track element identity across a reorder)
- **AND** the test harness performs no reconciliation step where that
  mechanism could matter (e.g. a single static, non-diffing render)
- **THEN** the test is rewritten to assert only what the harness can actually
  prove, and any claim the harness cannot support is removed from its
  title and comments
