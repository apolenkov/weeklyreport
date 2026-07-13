# ci-merge-gate

## Purpose

Define the merge-quality gate protecting `main` — server-side CI once provisioned, the local pre-push hook as interim substitute.

## Requirements

### Requirement: A Server-Side Merge Gate MUST Exist Before The First Production Point

The repository MUST have a server-side CI merge gate — a provisioned runner
plus `pull_request`/`push: [main]` triggers with required status checks —
active before the first production point is reached. Until a runner is
provisioned, `ci.yml` staying `workflow_dispatch`-only is an accepted,
tracked interim posture for the pre-production MVP phase, not a defect to
silently work around.

#### Scenario: No runner provisioned, still pre-production

- **WHEN** the repository has 0 GitHub Actions runners assigned and no
  production point has been reached
- **THEN** `ci.yml` triggering on `workflow_dispatch` only is compliant with
  this requirement
- **AND** the interim local gate (`.husky/pre-push`) is the active
  quality gate

#### Scenario: First production point is reached with no runner

- **WHEN** the repository is about to reach its first production point
- **THEN** a CI runner MUST be provisioned and `ci.yml`'s `on:` trigger MUST
  include `pull_request` and `push: { branches: [main] }`
- **AND** required status checks MUST be enabled on the `main` branch before
  the production point is marked reached

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
