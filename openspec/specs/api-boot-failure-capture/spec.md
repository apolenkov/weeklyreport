# api-boot-failure-capture Specification

## Purpose

Capture a failure before bootstrap with Sentry before the bounded
telemetry drain, keeping the process exit code 1 on every path.

## Requirements

### Requirement: A boot failure is captured by Sentry before telemetry drains

When bootstrap fails before the application exists, the API MUST print the error, capture it with Sentry, and only then drain the initialized OTel and Sentry telemetry within the bounded drain deadline. The process MUST exit with code 1 on every path. A capture failure MUST NOT skip the drain or replace the original error.

#### Scenario: Capture precedes the Sentry flush

- **WHEN** bootstrap rejects with an error and Sentry is initialized
- **THEN** the error is passed to `Sentry.captureException` before `Sentry.close` is called, and the process exits with code 1

#### Scenario: A capture failure still drains and exits

- **WHEN** bootstrap rejects and `Sentry.captureException` throws
- **THEN** the telemetry drain still runs and the process exits with code 1
