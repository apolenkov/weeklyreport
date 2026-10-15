# test-evidence-integrity Specification

## Purpose

Keep CI evidence truthful without a repository-local campaign or evidence harness.

## Requirements

### Requirement: API integration tests are a required CI lane

The API integration CI lane MUST execute the API integration suite against an
accepted disposable PostgreSQL target, Redis logical DB 15, and a reachable
Mailpit SMTP service. The lane MUST fail when any dependency is absent or any
integration test fails; it MUST NOT convert required checks into skips.

#### Scenario: Mailpit is unavailable

- **WHEN** the required integration lane cannot reach its configured Mailpit service
- **THEN** the lane fails non-zero instead of reporting skipped SMTP tests as PASS

#### Scenario: Integration suite passes

- **WHEN** all guarded database, Redis, and SMTP dependencies are available and every integration test passes
- **THEN** CI records the integration lane as PASS independently of the unit lane

### Requirement: Coverage proof is explicit and non-empty

The API and Web merge gates MUST invoke Vitest with coverage enabled and enforce
their declared thresholds without weakening exclusions. Their coverage configs
MUST keep the complete source scope explicit: API includes `src/**/*.ts` and
`src/**/*.tsx`, and Web includes `src/**/*.{ts,tsx}`. A missing, empty, or
out-of-scope report MUST fail through the stock Vitest coverage threshold gate;
no separate repository-owned evidence helper is required.

#### Scenario: Coverage is not collected

- **WHEN** a job omits coverage collection or produces no covered source denominator
- **THEN** the configured coverage gate fails even if the ordinary unit suite passes

#### Scenario: API and Web satisfy their declared floors

- **WHEN** both scoped reports are non-empty and meet their independently declared thresholds
- **THEN** the coverage lane passes without changing thresholds or exclusions

### Requirement: The API unit contour cannot reach a real Redis

The API unit test contour MUST provide a Redis host that cannot resolve, so a
real Redis client built from the unit defaults fails before any command
reaches a server, whatever Redis the developer or CI environment exposes. The
coverage contour, which runs the integration suites against the guarded Redis
target, MUST keep its own target.

#### Scenario: A unit test builds a real client from the defaults

- **WHEN** a unit test constructs a Redis client from the unit environment
- **THEN** the host does not resolve and the first command fails without a
  server connection

#### Scenario: The developer exports a real Redis host

- **WHEN** the shell running the unit contour exports `REDIS_HOST`
- **THEN** the unit contour still uses the unresolvable host
