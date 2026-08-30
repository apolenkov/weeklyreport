# deploy-config-integrity Specification

## Purpose

Keep the current development and production Compose definitions executable,
deterministic, and aligned with the repository's service graph.

## Requirements

### Requirement: Compose definitions use only current service surfaces

`docker-compose.yml` and `docker-compose.prod.yml` MUST describe the current
WeeklyReport service graph without references to removed Compose overlays,
staging variants, or error-only stacks. Required production values MUST fail
closed when absent rather than silently defaulting.

#### Scenario: Current Compose files render

- **WHEN** an operator renders the development or production Compose file with
  its documented environment
- **THEN** rendering succeeds with the current service graph
- **AND** no removed overlay or service is required

#### Scenario: Production values are missing

- **WHEN** a required production value is absent
- **THEN** Compose or the service configuration fails before the service accepts
  traffic

### Requirement: External Compose images are immutable

Every external `image:` reference in `docker-compose.yml` and
`docker-compose.prod.yml` MUST include an immutable `@sha256:` digest. Locally
built application images MAY use the release version supplied by the operator.

#### Scenario: A Compose image is inspected

- **WHEN** a service in either current Compose file uses an external image
- **THEN** its reference includes a full SHA-256 digest alongside the readable
  tag

### Requirement: Production builds use the frozen installed toolchain

The production API and Web build paths MUST acquire dependencies through their
explicit frozen install steps. Prisma generation, application compilation,
and migration startup MUST then use the installed toolchain without a second
package-manager install or registry preflight. The production configuration
gate MUST reject a Compose migration override or Dockerfile wrapper that
reintroduces dependency resolution after installation.

#### Scenario: Production migration starts

- **WHEN** the migration service starts from `docker-compose.prod.yml`
- **THEN** it invokes the installed Prisma binary directly
- **AND** it does not resolve or install dependencies at startup

#### Scenario: A late dependency install is introduced

- **WHEN** a production Dockerfile or Compose command adds a package-manager
  install or dependency preflight after the frozen install
- **THEN** the production configuration gate fails and identifies the
  non-deterministic invocation
