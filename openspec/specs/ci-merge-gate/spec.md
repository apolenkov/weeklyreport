# ci-merge-gate Specification

## Purpose

Define the CI-authoritative acceptance gate for `main`.

## Requirements

### Requirement: CI runs the complete repository acceptance gate

`.github/workflows/ci.yml` MUST run for pull requests, pushes to `main`, and
manual dispatch while it remains the authoritative gate — this requirement is
transitional and retires when the GitLab main cutover completes. Its jobs MUST
cover the repository's current acceptance surfaces: format, lint, OpenSpec
validation, typecheck, unit tests, the complete workspace build, disposable
database integration, coverage, reset safety, and production Compose builds.
Docker target builds do not replace the complete workspace build because their
filters may omit an independently buildable package.

#### Scenario: A pull request runs the gate

- **WHEN** a pull request is opened or updated
- **THEN** CI runs the quality job including the complete workspace build, plus
  the integration, coverage, reset, and production Compose build jobs
- **AND** a failed job makes the workflow fail

#### Scenario: A push to main runs the gate

- **WHEN** a commit is pushed to `main`
- **THEN** the same acceptance workflow runs
- **AND** its result is the authoritative repository-level acceptance signal

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

The complete workspace build (`pnpm build`), production Compose builds, PDF
export, and browser acceptance MUST remain required acceptance evidence,
collected outside GitLab CI and bound to the exact source SHA. Their absence
from `.gitlab-ci.yml` is not a waiver, and the GitHub workflow jobs that
provide them stay until the contract gates are retargeted.

#### Scenario: Acceptance without outside-CI build evidence

- **WHEN** a candidate is proposed for `main` acceptance
- **THEN** the required build, PDF, and browser evidence exists for the exact
  source SHA, or acceptance fails

### Requirement: CI actions are pinned and read-only by default

Every `uses:` step in the current action-based CI workflow MUST reference a
full commit SHA with its readable release tag preserved in a comment. The
workflow default permission MUST be `contents: read`; a job that needs more
authority MUST declare only that permission at job scope. `.gitlab-ci.yml`
carries no `uses:` steps; its image references are versioned
`tag@sha256:` digests held in sync by the runtime declaration gate.

#### Scenario: A CI action is inspected

- **WHEN** the current CI workflow is parsed
- **THEN** every action reference is immutable and its default token is
  read-only

### Requirement: CI does not depend on local hooks

The acceptance gate MUST be complete when evaluated in a clean checkout by the
workflow itself. No local Git hook, opt-out variable, or developer-machine state
may be required for CI acceptance.

#### Scenario: A clean runner evaluates the repository

- **WHEN** the CI workflow runs in a fresh runner checkout
- **THEN** all required checks execute from the workflow and do not invoke a
  local Git hook

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
