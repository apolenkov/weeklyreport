# sweep-runtime-correctness Specification

## Purpose

Require focused product tests to fail for the runtime, accessibility, and
behavioral defects they claim to cover.

## Requirements

### Requirement: Web tests and their subject doc comments MUST be able to fail for the behavior they name

Every test in `apps/web` MUST assert on the specific behavior its title or
comment claims to verify, such that a regression in that behavior makes the
test fail. A test whose assertions pass regardless of the named behavior
(e.g. checking accessible-name equality against a hardcoded string that a
prior CSS/ARIA property makes true unconditionally, or checking set
membership when the claim is "changed to a different value") is a defect,
not a passing test. Doc comments and file-header comments MUST describe what
the code actually does; a comment stating the opposite of the executed
behavior (including a comment claiming code "no longer exists" when it is
still defined and called) MUST be corrected to match the code. A pure
decision-ladder function that determines a user-visible outcome MUST have
each of its branches directly covered, and an assertion against a
locally-declared fixture value MUST NOT be treated as coverage of the
function under test unless that value is actually passed to it.

#### Scenario: An accessible-name test attributes its pass to the wrong mechanism

- **WHEN** a test asserts an element's accessible name via `getByRole(...,
{ name })`
- **AND** the element has an explicit `aria-label` that alone determines the
  computed name regardless of a sibling/descendant attribute the test's
  comment credits (e.g. a decorative icon's `aria-hidden`)
- **THEN** the test and its comment state the actual mechanism (the explicit
  label wins over descendant content) and additionally assert the computed
  name differs from the element's own visible text, so the test can still
  fail if the label is ever removed

#### Scenario: A "disables X" test never drives the disabling input past its threshold

- **WHEN** a test title claims a control disables once an input crosses a
  documented limit (e.g. a character-count cap)
- **THEN** the test drives the input strictly past that limit (bypassing any
  DOM attribute like `maxLength` that would otherwise clamp a real keystroke)
  and asserts the target control's `disabled` state, not merely an
  intermediate display artifact (e.g. a counter) below the threshold

#### Scenario: A "subset of X" invariant test's fixture cannot produce a non-member

- **WHEN** a test claims one derived collection is a strict subset of (or
  otherwise bounded by) a specific upstream input
- **AND** a sibling test elsewhere in the codebase demonstrates a concrete
  fixture where the derived collection contains a value NOT present in that
  claimed upstream input
- **THEN** the subset test is rewritten with a fixture that actually
  exercises the boundary (a value present via the wider real contract but
  absent from the claimed narrower one), and either the test/comment is
  corrected to state the real, wider contract, or the implementation is
  fixed to match the narrower claim — not left passing on a fixture that
  can't distinguish the two

#### Scenario: A "cycles/changes to different value" test only checks set membership

- **WHEN** a test claims a value changes to something different after an
  event or elapsed time
- **THEN** the test captures the value before the change and asserts the
  post-change value differs from the captured value, in addition to any
  membership/shape check

#### Scenario: A file-header comment claims code was deleted that still exists

- **WHEN** a test file's header comment states specific functions "no longer
  exist" or were "deleted"
- **AND** those functions are defined in the module under test and called by
  other production code
- **THEN** the comment is removed or corrected, and the still-live functions
  it discusses receive direct unit test coverage

#### Scenario: A round-trip/lineage invariant is never exercised because fixtures omit the field

- **WHEN** a module's documented headline invariant is that a specific field
  (e.g. a durable identifier) must round-trip unchanged through a mapper
- **AND** every test fixture omits that field, so a matcher that ignores
  `undefined`-valued keys (e.g. `toEqual`) cannot detect its loss
- **THEN** fixtures supply an explicit, distinguishable value for that field
  and a test asserts it survives the mapper exactly

#### Scenario: Security-adjacent branching in a UI component has no direct test

- **WHEN** a component gates a destructive or privileged affordance (e.g. a
  delete control, an edit composer) behind more than one condition (e.g.
  authorship AND a capability flag, OR an admin override)
- **THEN** each reachable combination of those conditions has a direct test
  asserting the affordance is present or absent as designed, not only an
  unrelated styling/layout assertion

#### Scenario: A reflexive-key safety guard has no regression test

- **WHEN** a component intentionally restricts a key-triggered action (e.g.
  Enter) to firing only while a specific element holds focus, to prevent an
  unrelated keypress from triggering it
- **THEN** a test asserts the action does NOT fire when the key is pressed
  while focus is elsewhere, in addition to any test asserting it DOES fire
  when focus is on the intended element

#### Scenario: Test mocks and comments describe a dependency the component no longer has

- **WHEN** a test file mocks a dependency (e.g. a data-fetching hook or
  client) and its comment attributes that mock to a specific rendered
  feature
- **AND** the component under test no longer reads that dependency for that
  feature
- **THEN** the stale mock and comment are removed, or corrected to name the
  actual current dependent, so the test suite doesn't misrepresent the
  component's real contract

#### Scenario: A test and a doc comment share the same stale premise about visible content

- **WHEN** a test asserts the absence of visible text using a pattern that
  omits a word the component actually renders, and the component's own doc
  comment states the same outdated premise (e.g. "icon-only")
- **THEN** both the test and the doc comment are corrected to state and
  assert the component's actual current rendering (e.g. a visible label
  alongside the icon)

#### Scenario: A decision-ladder function's branches are unexercised

- **WHEN** a pure function resolves a user-visible outcome from multiple
  ranked or filtered inputs (e.g. a badge/status resolver that filters
  stale entries and ranks competing states)
- **THEN** each branch of the ladder (each filter condition and each
  ranking outcome) has a direct test driving it, not only an end-to-end
  render test that happens to exercise one branch

#### Scenario: An assertion targets a fixture value never passed to the function under test

- **WHEN** a test declares a fixture value and asserts on that same fixture
  value directly (e.g. `expect(localFixture).toEqual(...)`) rather than on
  the return value of the function under test
- **THEN** the assertion is deleted or rewritten to assert on the function's
  actual output for an input that exercises the claimed path

### Requirement: API tests and their subject doc comments MUST be able to fail for the behavior they name

Every test in `apps/api` MUST assert on the specific behavior its title or
comment claims to verify, such that a regression in that behavior makes the
test fail. A test whose assertions pass regardless of the named behavior
(e.g. checking element presence via `toContain` when the claim is about
order, or probing keys a return type structurally never carries) is a
defect, not a passing test. Doc comments (JSDoc/docstrings) on a function
MUST describe what the function's code actually does; a comment stating the
opposite of the executed branch MUST be corrected to match the code, not the
other way around, unless the code itself is the confirmed bug. A test that
asserts a metric/telemetry side effect MUST wire the real
telemetry/metrics collaborator, not a no-op stub, and MUST NOT
reimplement the production guard logic it claims to cover in place of
calling through to it.

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

#### Scenario: A telemetry assertion is built on a no-op collaborator

- **WHEN** a test asserts that an operation "skews no metric" or otherwise
  checks a counter/gauge is unchanged after a code path runs
- **AND** the service under test was constructed with a no-op telemetry
  implementation instead of the real metrics collaborator
- **THEN** the test is rebuilt with the real telemetry collaborator (as any
  sibling test in the same file that does assert a metric change already
  does), so the assertion can fail if the service starts incrementing the
  counter wrongly

#### Scenario: A test reimplements the guard it claims to cover

- **WHEN** a test file defines a local helper that duplicates the logic of a
  production guard (e.g. a router procedure's authorization/rate-limit
  check) instead of calling through to the real guard
- **THEN** the test is rewritten to exercise the real guard (the router
  procedure itself, or the shared function it delegates to, exported for
  direct testing), and the local reimplementation is deleted

### Requirement: Runtime correctness MUST be proven without an exhaustive interaction platform

React warning, hydration, accessibility, console-source, and behavior-focused
assertion requirements MUST be verified by focused tests colocated with product
modules. No correctness requirement may require a root browser harness, route
sweep, catalog, continuation graph, campaign ledger, per-control traversal, or
AI-import protocol as its sole evidence source.

#### Scenario: A runtime correctness regression is introduced

- **WHEN** a focused product test observes a covered React warning, hydration
  error, console failure, or targeted accessibility defect
- **THEN** the smallest owning test fails and identifies the product surface
- **AND** no route matrix or exhaustive campaign is needed to reproduce it
