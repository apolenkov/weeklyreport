## MODIFIED Requirements

### Requirement: Durable behavior-anchored Scenario Catalog

UI behavior SHALL be defined in a durable, high-level Scenario Catalog of `role + route + intent + Given/When/Then` outcomes anchored to observable behavior, never to a code location. The catalog SHALL NOT enumerate every element, state, transition, or browser action. Route health consumes its route surface; focused deterministic suites own detailed behavior.

#### Scenario: Scenario anchored to behavior, not code

- **WHEN** a Behavioral Scenario is authored for a role and route
- **THEN** it describes observable behavior and contains no `file:line` reference

#### Scenario: Catalog stays high-level, not exhaustive

- **WHEN** the catalog is reviewed
- **THEN** each entry remains a role, route, and intent contract rather than a per-element interaction graph

## ADDED Requirements

### Requirement: Deterministic browser gate remains smoke-only

The blocking browser gate MUST contain only four-role route health and one representative lead write, head publication, and viewer read-back lifecycle. Detailed behaviors MUST remain in focused tests rather than being duplicated into a browser journey matrix.

#### Scenario: Browser acceptance is discovered

- **WHEN** the acceptance commands list their scenarios
- **THEN** smoke discovery contains one lifecycle and combined discovery adds only route health

### Requirement: Human and AI review is advisory

Human or model-driven browser review MAY inspect WeeklyReport, but MUST NOT write or replace the deterministic acceptance verdict. A candidate blocks only after deterministic reproduction or reviewed product evidence.

#### Scenario: Advisory review reports a candidate

- **WHEN** a human or model reports a possible browser defect
- **THEN** the candidate is reproduced or reviewed before it affects acceptance

### Requirement: Acceptance harness boundary

Blocking browser acceptance MUST live under `e2e/acceptance/`. It MUST reuse canonical catalog, authentication, seed, database, Redis, and navigation contracts while keeping focused integration and unit suites independently runnable.

#### Scenario: Acceptance needs shared behavior

- **WHEN** acceptance needs an existing generic E2E behavior
- **THEN** it reuses the maintained helper without creating another runner or campaign protocol

### Requirement: Per-role route health produces a blocking verdict

Route health MUST authenticate the canonical lead, head, admin, and viewer roles, visit every reachable catalog route, preserve a per-role report, and fail on unclassified HTTP, console, page, network, or axe anomalies.

#### Scenario: A role route has an anomaly

- **WHEN** route health observes an unclassified failure
- **THEN** the role report records its route and evidence before the test fails

## REMOVED Requirements

### Requirement: Catalog generated from code, human-reviewed

**Reason**: Agent fan-out and runtime Driver generation are orchestration details, not durable product behavior.

**Migration**: Keep the catalog human-reviewed and enforce route drift through `catalog:check`.

### Requirement: Swappable Driver (human or AI agent)

**Reason**: The mandatory shared Driver protocol and owned AI tooling were retired.

**Migration**: Treat human or model browser review as optional advisory input.

### Requirement: Deterministic frozen gate remains deferred

**Reason**: The replacement now defines a deliberately small deterministic smoke gate rather than deferring all browser behavior.

**Migration**: Use route health plus the single lifecycle smoke; detailed behavior stays in focused tests.

### Requirement: Test-harness boundary

**Reason**: The old boundary named the retired `e2e/sweep/` Playwright harness.

**Migration**: Blocking browser acceptance lives under `e2e/acceptance/`; reusable catalog helpers remain under `e2e/sweep/`.

### Requirement: Coverage Catalog and MBT stay out of scope

**Reason**: The replacement contract already forbids exhaustive graphs and no longer needs a deferred Driver-era requirement.

**Migration**: Add any future model-based testing proposal as a separate measured OpenSpec change.

### Requirement: Negative-authz matrix stays out of scope

**Reason**: Authorization ownership remains in focused backend and route tests and does not need a Driver-specific requirement.

**Migration**: Keep canonical role middleware and route guards as the authorization source of truth.

### Requirement: Per-role sweep produces a blocking accessibility verdict

**Reason**: The old requirement coupled accessibility blocking to exhaustive Driver exploration.

**Migration**: Four-role route health owns blocking axe, console, page, network, and HTTP anomalies.
