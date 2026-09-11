# ci-merge-gate Specification

## Purpose

Define the CI-authoritative acceptance gate for `main`.

## Requirements

### Requirement: CI runs the complete repository acceptance gate

`.github/workflows/ci.yml` MUST run for pull requests, pushes to `main`, and
manual dispatch. Its jobs MUST cover the repository's current acceptance
surfaces: format, lint, OpenSpec validation, typecheck, unit tests, the complete
workspace build, disposable database integration, coverage, reset safety, and
production Compose builds. Docker target builds do not replace the complete
workspace build because their filters may omit an independently buildable
package.

#### Scenario: A pull request runs the gate

- **WHEN** a pull request is opened or updated
- **THEN** CI runs the quality job including the complete workspace build, plus
  the integration, coverage, reset, and production Compose build jobs
- **AND** a failed job makes the workflow fail

#### Scenario: A push to main runs the gate

- **WHEN** a commit is pushed to `main`
- **THEN** the same acceptance workflow runs
- **AND** its result is the authoritative repository-level acceptance signal

### Requirement: CI actions are pinned and read-only by default

Every `uses:` step in the current CI workflow MUST reference a full commit SHA
with its readable release tag preserved in a comment. The workflow default
permission MUST be `contents: read`; a job that needs more authority MUST
declare only that permission at job scope.

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
