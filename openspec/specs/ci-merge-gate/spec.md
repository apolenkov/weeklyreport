# ci-merge-gate Specification

## Purpose

Define the GitLab CI lint/test gate for `main` and the acceptance evidence that
must be collected outside CI.

## Requirements

### Requirement: GitLab CI carries only lint and test lanes

Per the owner decision of 2026-09-28, `.gitlab-ci.yml` MUST run only lint and
test lanes: `node-toolchain`, `quality`, `coverage`, `api-integration`, and
`migrate-reset` on push pipelines, plus `dependency-scan` on schedule and
manual pipelines. It MUST NOT run Docker-in-Docker, image builds, or
operational smoke checks. Disposable-database lanes MUST satisfy the exact
loopback destructive guard with a real PostgreSQL process inside the job
container bound to `127.0.0.1`; a GitLab service alias MUST NOT be presented
as a loopback database target. Redis and Mailpit MAY run as ordinary service
aliases.

#### Scenario: A push pipeline runs lint and tests

- **WHEN** a branch or merge-request pipeline runs on GitLab
- **THEN** it contains the lint/test jobs above and no Docker build or
  Compose smoke job
- **AND** database lanes use an in-job loopback PostgreSQL with Redis and
  Mailpit as service aliases

### Requirement: Product-build evidence stays required outside CI

The complete workspace build (`pnpm build`), production Compose builds, PDF export, and browser acceptance MUST remain required acceptance evidence, collected outside GitLab CI and bound to the exact source SHA. Their absence from `.gitlab-ci.yml` is not a waiver.

#### Scenario: Acceptance without outside-CI build evidence

- **WHEN** a candidate is proposed for `main` acceptance
- **THEN** the required build, PDF, and browser evidence exists for the exact source SHA, or acceptance fails

### Requirement: CI does not depend on local hooks

The lint/test lanes MUST be complete when evaluated in a clean checkout by `.gitlab-ci.yml` itself. No local hook, opt-out variable, or developer-machine state may be required for CI acceptance.

#### Scenario: A clean runner evaluates the repository

- **WHEN** the GitLab pipeline runs in a fresh job checkout
- **THEN** all required lint and test checks execute from `.gitlab-ci.yml` and do not invoke a local hook

### Requirement: Web typecheck covers maintained TypeScript entrypoints

The existing web TypeScript project MUST typecheck maintained first-party
TypeScript under `src` and `scripts` plus root web runtime, framework, build,
test configuration, setup, and test files. Framework-required root placement
MUST remain intact. The repository MUST NOT create a duplicate TypeScript
project solely to cover these files.

#### Scenario: web typecheck enumerates maintained root files

- **WHEN** the web TypeScript compiler lists its program files
- **THEN** the root Next.js, Vitest, instrumentation-client, Sentry options, setup, and test TypeScript files are present
- **AND** the server instrumentation hook under `src` is present

#### Scenario: framework configuration remains at the application root

- **WHEN** root web files are added to typecheck coverage
- **THEN** Next.js and Vitest configuration files remain in their framework-required locations
- **AND** the existing web typecheck command compiles them

### Requirement: Production output checks require runtime entrypoints

The production output gate MUST reject a missing or non-file runtime entrypoint. API mode MUST require the emitted API main module and the embedded shared and report-persistence package indexes. Shared mode MUST require the standalone shared package index. Combined mode MUST require both output sets. Merely existing or empty output directories MUST NOT establish a successful build check.

#### Scenario: API output is incomplete

- **WHEN** the API output directory exists but its main module or either embedded package index is missing
- **THEN** API and combined checks fail and identify missing entrypoints

#### Scenario: Shared output is empty

- **WHEN** the standalone shared output directory exists without its index module
- **THEN** shared and combined checks fail

#### Scenario: Selected output is complete

- **WHEN** the selected mode has every required regular entrypoint file and satisfies existing output policy checks
- **THEN** the production output gate succeeds

### Requirement: CI images are pinned by digest

Every image referenced by `.gitlab-ci.yml` MUST be a versioned `tag@sha256:` digest reference, held in sync with the runtime declarations by the runtime declaration gate.

#### Scenario: A CI image is inspected

- **WHEN** `.gitlab-ci.yml` job and service images are listed
- **THEN** every reference is immutable and reviewed by the external-image policy
