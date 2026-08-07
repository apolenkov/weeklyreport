# ci-merge-gate

## Purpose

Define the server-side CI and branch-enforcement boundary for `main`, while
keeping the local pre-push hook as defense in depth rather than a substitute.

## Requirements

### Requirement: A Server-Side Merge Gate MUST Exist Before The First Production Point

The repository MUST run CI for pull requests and pushes to `main`, and MUST have
required status checks on a protected `main` before the first production point.
During the pre-production MVP phase, active GitHub-hosted CI with an unprotected
`main` is an accepted, explicitly recorded gap; it MUST NOT be described as an
enforced merge gate. The local pre-push hook remains an additional developer
gate and MUST NOT be presented as server-side enforcement.

#### Scenario: CI runs while main remains unprotected in pre-production

- **WHEN** CI triggers on pull requests and pushes to `main` but the Branches API
  reports `main` as unprotected
- **THEN** the repository records that server-side checks run but do not block a
  direct or red update to `main`
- **AND** reports distinguish successful CI execution from merge enforcement
- **AND** the local pre-push gate remains active as defense in depth

#### Scenario: First production point is reached with no enforced checks

- **WHEN** the repository is about to reach its first production point
- **THEN** `main` MUST be protected by a branch rule or ruleset
- **AND** stable CI and security status checks MUST be required
- **AND** force-push, deletion, review, conversation-resolution, and bypass
  behavior MUST be explicitly verified and recorded

#### Scenario: Administrative settings cannot be read

- **WHEN** the current token or repository plan prevents a ruleset or branch
  protection query
- **THEN** the setting remains unverified
- **AND** the project MUST NOT infer enforcement from workflow files alone

### Requirement: The Interim Local Gate MUST Cover Every Deterministic, Service-Free CI Check

`.husky/pre-push` MUST run every check from `ci.yml`'s `quality` job that
requires no external service (database, Redis) and no built artifact, for as
long as the server-side merge gate from the requirement above is not yet
active. Checks that need services or a build (integration tests, the
Playwright e2e suite, the `migrate reset` drift job, the Docker build job,
visual regression) stay CI-only and are explicitly out of scope for
`pre-push`.

#### Scenario: pre-push runs the full deterministic subset

- **WHEN** a developer runs `git push` with `SKIP_PREPUSH` unset
- **THEN** `.husky/pre-push` runs, in order, typecheck, lint, format:check,
  catalog drift (`pnpm catalog:check`), the mutation-consumer audit
  (`pnpm uat:audit`), and unit tests
- **AND** a failure in any of those checks aborts the push

#### Scenario: A service-dependent check stays CI-only

- **WHEN** a check requires Postgres, Redis, or a built Docker image
  (integration tests, e2e, `migrate reset`, Docker build, visual regression)
- **THEN** that check MUST NOT be added to `.husky/pre-push`
- **AND** it MUST remain a job in `ci.yml` for the future server-side gate

### Requirement: The Pre-Push Skip Condition MUST Be Hook-Specific

`.husky/pre-push`'s skip condition MUST depend only on a hook-specific
opt-out variable (`SKIP_PREPUSH=1`). It MUST NOT key off the ambient `CI`
environment variable, because `CI=true` is commonly set by tooling and CI
providers unrelated to this repository's own `ci.yml` and would silently
disable the only active merge gate in any such environment.

#### Scenario: SKIP_PREPUSH explicitly opts out

- **WHEN** a developer runs `SKIP_PREPUSH=1 git push`
- **THEN** `.husky/pre-push` prints a skip message and exits 0 without
  running any check

#### Scenario: An ambient CI=true does not silently bypass the gate

- **WHEN** a developer's shell or an unrelated tool has `CI=true` set in the
  environment and `SKIP_PREPUSH` is unset
- **THEN** `.husky/pre-push` still runs its full deterministic check chain
