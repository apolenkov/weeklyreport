# behavioral-ui-regression-gate Specification

## Purpose

Define a durable, behavior-anchored Scenario Catalog and one bounded,
deterministic browser gate for WeeklyReport, while keeping human and model
review advisory.

## Requirements

### Requirement: Durable behavior-anchored Scenario Catalog

UI behavior SHALL be defined in a durable, high-level Scenario Catalog of
`role + route + intent + Given/When/Then` outcomes anchored to observable
behavior, never to a code location. The catalog SHALL NOT enumerate every
element, state, transition, or browser action. Route health consumes its route
surface; focused deterministic suites own detailed behavior.

#### Scenario: Scenario anchored to behavior, not code

- **WHEN** a Behavioral Scenario is authored for a role and route
- **THEN** it describes observable behavior and contains no `file:line`
  reference

#### Scenario: Catalog stays high-level, not exhaustive

- **WHEN** the catalog is reviewed
- **THEN** each entry remains a role, route, and intent contract rather than a
  per-element interaction graph

### Requirement: Deterministic browser gate remains smoke-only

The blocking browser gate MUST contain only four-role route health and one
representative lead write, head publication, and viewer read-back lifecycle.
Detailed behaviors MUST remain in focused tests rather than being duplicated
into a browser journey matrix.

#### Scenario: Browser acceptance is discovered

- **WHEN** the acceptance commands list their scenarios
- **THEN** smoke discovery contains one lifecycle and combined discovery adds
  only route health

### Requirement: Human and AI review is advisory

Human or model-driven browser review MAY inspect WeeklyReport, but MUST NOT
write or replace the deterministic acceptance verdict. A candidate blocks only
after deterministic reproduction or reviewed product evidence.

#### Scenario: Advisory review reports a candidate

- **WHEN** a human or model reports a possible browser defect
- **THEN** the candidate is reproduced or reviewed before it affects acceptance

### Requirement: Acceptance harness boundary

Blocking browser acceptance MUST live under `e2e/acceptance/`. It MUST reuse
canonical catalog, authentication, seed, database, Redis, and navigation
contracts while keeping focused integration and unit suites independently
runnable.

#### Scenario: Acceptance needs shared behavior

- **WHEN** acceptance needs an existing generic E2E behavior
- **THEN** it reuses the maintained helper without creating another runner or
  campaign protocol

### Requirement: Per-role route health produces a blocking verdict

Route health MUST authenticate the canonical lead, head, admin, and viewer
roles, visit every reachable catalog route, preserve a per-role report, and
fail on unclassified HTTP, console, page, network, or axe anomalies.

#### Scenario: A role route has an anomaly

- **WHEN** route health observes an unclassified failure
- **THEN** the role report records its route and evidence before the test fails
