# operations-local-readiness Specification

## Purpose

Ensure every repository-owned development and operations instruction agrees with executable configuration while keeping external production dependencies explicit.

## Requirements

### Requirement: Repository-owned operations instructions are executable

The repository-owned development and operations instructions, including Compose, observability, metrics, Grafana, SMTP, staging, and restore surfaces, MUST agree with the checked-in service graph, required environment variables, routes, credentials, and ownership declarations.

#### Scenario: A documented environment is rendered

- **WHEN** the documented example environment is supplied to its Compose stack
- **THEN** configuration rendering succeeds without a missing required variable or duplicate application port owner

#### Scenario: Metrics remain internal

- **WHEN** an operator follows the observability runbook
- **THEN** the documentation identifies the actual internal scrape path and does not claim a public Caddy `/metrics` route

### Requirement: Local safety automation fails closed

The backup automation and repository post-update hooks MUST validate positive integer cadence and retention inputs before looping or deleting backups, and MUST propagate dependency-install or generated-client failures to their caller.

#### Scenario: Backup cadence is invalid

- **WHEN** cadence or retention is empty, zero, negative, or non-numeric
- **THEN** the backup process exits non-zero before entering a hot loop or deleting backups

#### Scenario: A post-update hook command fails

- **WHEN** dependency installation or generated-client refresh fails
- **THEN** the Git hook exits non-zero and exposes the failed step

### Requirement: External production controls are not simulated

The repository-owned operations documentation and readiness checks MUST identify alert receivers, off-host encrypted backup storage, scheduled restore drills, platform protection, immutable artifacts, and release records as unproven until their external systems provide read-back evidence.

#### Scenario: Only local configuration passes

- **WHEN** all repository-owned operations checks pass but an external receiver or recovery target has no read-back proof
- **THEN** local readiness is PASS and the external prerequisite remains BLOCKED rather than being reported as complete
