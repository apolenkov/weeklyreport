# scenario-catalog Specification

## Purpose

TBD - created by archiving change establish-scenario-catalog. Update Purpose after archive.

## Requirements

### Requirement: The catalog is derived from four independent sources

The catalog MUST be derived by triangulating four independent sources of truth,
never from any single one: (1) the full code entry-point surface, (2) the Prisma
domain model (entities and state enums), (3) existing OpenSpec specs, mapped via
(4) the codegraph index. The code entry-point surface MUST include not only tRPC
procedures but ALL entry points — REST controllers, BullMQ processors, cron
schedulers, and Next.js route handlers — because core domain behavior (the
PeriodState lifecycle) is driven by schedulers that no procedure walk reaches.

#### Scenario: a scheduler-driven state transition is cataloged

- **WHEN** the catalog is derived
- **THEN** every `PeriodState` transition driven by a cron scheduler
  (`period-creator`, `auto-publisher`, `auto-archiver`) appears as a scenario
- **AND** it is not omitted merely because no tRPC procedure triggers it

#### Scenario: an entity with no covering entry point is flagged as a gap

- **WHEN** the gap critic compares the Prisma domain model against the
  entry-point surface
- **THEN** any entity or enum state value with no writer or reader entry point is
  reported as a coverage gap rather than silently dropped

### Requirement: Every scenario has a machine-checkable outcome

Every scenario's `Then` MUST assert a concrete, machine-verifiable outcome — a
persisted field value, a returned shape, a visible string, or a console-error
count — never prose such as "it works". A scenario whose `Then` cannot be
mechanically checked MUST NOT be admitted to the catalog.

#### Scenario: a non-assertable outcome is rejected

- **WHEN** a scenario is authored with a `Then` that names no checkable condition
- **THEN** it is rejected from the catalog until the `Then` states a concrete
  assertion (field value, returned shape, visible text, or error count)

### Requirement: Every scenario links to the code it covers and its test

Each scenario MUST carry a traceable link to the entry point it exercises
(procedure, route, processor, or scheduler) and to the test that asserts it, or
be explicitly marked uncovered. These links are what allow a change's diff to be
intersected with the catalog to select exactly the affected scenarios.

#### Scenario: a diff selects only its affected scenarios

- **WHEN** a code change is proposed
- **THEN** intersecting the changed files with the catalog's code links yields
  the exact set of affected scenarios to re-run
- **AND** scenarios whose linked code was untouched are not re-run

### Requirement: A drift gate keeps the catalog honest

A CI-runnable check MUST re-derive the code entry-point surface (procedures, all
entry points, entity enums) and FAIL when the code exposes surface that the
catalog does not cover. The catalog is a living contract, not a snapshot; without
this gate it silently diverges from the code, exactly as the `period-dual-state`
spec drifted from the carry-over implementation.

#### Scenario: a new uncovered entry point fails the gate

- **WHEN** a new entry point (procedure, route, processor, or scheduler) is added
  without a corresponding catalog scenario
- **THEN** the drift check exits non-zero in CI
- **AND** it names the uncovered surface

### Requirement: Execution is two-tier with a fixed human/AI division

The catalog MUST drive two execution tiers from one source: an API tier (every
entry point, asserted via Vitest/Playwright) and a UI tier (the interactive
subset, exercised by browser click-through). Authorship of intent (the `Then`)
and judgement of ambiguous failures stay human- or Sonnet-owned; mechanical
execution is delegated to the cheapest capable model (Haiku). Entry points with
no UI path MUST be marked `api-only` and never assigned to UI click-through.

#### Scenario: an api-only entry point is not handed to click-through

- **WHEN** a scheduler or system procedure with no UI control is scheduled for
  testing
- **THEN** it is executed on the API tier
- **AND** it is not assigned to a UI click-through agent

### Requirement: The catalog is documentation, not a new test runner

The catalog MUST be stored as Given/When/Then `.feature` documents under
`e2e/catalog/`, one per module. Automation MUST grow the existing native
`@playwright/test` and Vitest suites; a BDD runner MUST NOT be introduced, to
avoid a second competing test framework in the repo.

#### Scenario: automation reuses the existing harness

- **WHEN** a catalog scenario is automated
- **THEN** the resulting test is added to the existing `e2e/` Playwright suite or
  a Vitest suite
- **AND** no BDD-runner dependency is added to the workspace
