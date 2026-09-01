# deploy-config-integrity Specification

## Purpose

Keep the current development and production Compose definitions executable,
deterministic, and aligned with the repository's service graph.

## Requirements

### Requirement: Compose definitions use only current service surfaces

`docker-compose.yml` and `docker-compose.prod.yml` MUST describe the current
WeeklyReport service graph with positive ownership declarations for every
current service. Required production values MUST fail
closed when absent rather than silently defaulting.

#### Scenario: Current Compose files render

- **WHEN** an operator renders the development or production Compose file with
  its documented environment
- **THEN** rendering succeeds with the current service graph
- **AND** every declared service has an active owner in the current graph

#### Scenario: Production values are missing

- **WHEN** a required production value is absent
- **THEN** Compose or the service configuration fails before the service accepts
  traffic

### Requirement: External Compose images are immutable and identifiable

Every external `image:` reference in current Compose and CI service definitions
MUST use an explicit release tag and an immutable `@sha256:` digest. Floating
tags such as `latest` MUST NOT identify a reviewed runtime. Locally built
application images MAY use the release version supplied by the operator.

#### Scenario: An external image is inspected

- **WHEN** a current Compose or CI service uses an external image
- **THEN** its reference includes an explicit release tag and full SHA-256 digest
- **AND** the tag identifies the release whose runtime contract was reviewed

#### Scenario: A floating tag is introduced

- **WHEN** an external service image uses `latest` or another moving tag
- **THEN** the repository configuration gate rejects the reference

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
