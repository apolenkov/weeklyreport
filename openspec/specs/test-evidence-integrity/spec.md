# test-evidence-integrity Specification

## Purpose

Make CI evidence truthful by requiring the integration and coverage work that the repository currently declares but does not execute.

## Requirements

### Requirement: API integration tests are a required CI lane

The API integration CI lane MUST execute the API integration suite against an accepted disposable PostgreSQL target, Redis logical DB 15, and a reachable Mailpit SMTP service. The lane MUST fail when any dependency is absent or any integration test fails; it MUST NOT convert required checks into skips.

#### Scenario: Mailpit is unavailable

- **WHEN** the required integration lane cannot reach its configured Mailpit service
- **THEN** the lane fails non-zero instead of reporting skipped SMTP tests as PASS

#### Scenario: Integration suite passes

- **WHEN** all guarded database, Redis, and SMTP dependencies are available and every integration test passes
- **THEN** CI records the integration lane as PASS independently of the unit lane

### Requirement: Coverage proof is explicit and non-empty

The API and Web merge gates MUST invoke their test runners with coverage enabled, enforce their declared thresholds without weakening exclusions, and prove that each produced report contains a non-zero execution denominator for its intended source scope.

#### Scenario: Thresholds exist but coverage is not collected

- **WHEN** a job omits coverage collection or emits an empty report
- **THEN** the coverage gate fails even if the ordinary unit suite passes

#### Scenario: API and Web satisfy their declared floors

- **WHEN** both scoped reports are non-empty and meet their independently declared thresholds
- **THEN** the coverage gate passes without changing thresholds or exclusions
