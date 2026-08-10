# Rate-limit Store Readiness Specification

## Purpose

Define the API boot and runtime behavior that keeps ingress rate limiting shared, bounded, observable, and recoverable when Redis availability changes.

## Requirements

### Requirement: Shared rate-limit storage is ready before ingress

Outside sanctioned test mode, the API MUST establish readiness of its internally owned Redis rate-limit client before mounting or accepting public ingress traffic.

#### Scenario: Healthy Redis at API startup

- **WHEN** the API boots with valid Redis configuration and Redis is reachable
- **THEN** rate-limit store construction completes without degraded-store error logs
- **AND** the first guarded request is counted in the shared Redis bucket

#### Scenario: Redis cannot become ready at API startup

- **WHEN** the internally owned rate-limit client cannot establish readiness
- **THEN** limiter construction rejects and API boot does not report a listening state

### Requirement: Runtime Redis faults remain bounded and observable

After successful startup, a Redis store command failure MUST use bounded local enforcement and MUST emit the established error metric and structured log.

#### Scenario: Redis fails after startup

- **WHEN** a guarded request encounters a Redis store error after startup
- **THEN** the local degraded store enforces the configured budget
- **AND** the store-error metric and structured error log are emitted
