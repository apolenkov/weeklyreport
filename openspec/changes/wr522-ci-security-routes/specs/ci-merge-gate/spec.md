## MODIFIED Requirements

### Requirement: GitLab CI carries lint and test lanes and a gated image build

Per the owner decisions of 2026-09-28, 2026-10-01 and TASK-522, `.gitlab-ci.yml`
MUST run the lint and test lanes `node-toolchain`, `quality`, `coverage`,
`api-integration`, and `migrate-reset` on push pipelines, plus the blocking
routes `secret-scan`, `dependency-scan`, `mutation-period` and
`production-build` specified below. It MAY run one
image-build job and one manual deploy job as specified below. It MUST NOT run
Docker-in-Docker or operational smoke checks. Disposable-database lanes MUST
satisfy the exact loopback destructive guard with a real PostgreSQL process
inside the job container bound to `127.0.0.1`; a GitLab service alias MUST NOT
be presented as a loopback database target. Redis and Mailpit MAY run as
ordinary service aliases.

#### Scenario: A push pipeline runs lint and tests

- **WHEN** a branch or merge-request pipeline runs on GitLab
- **THEN** it contains the lint/test jobs above and no Docker-in-Docker or Compose smoke job
- **AND** database lanes use an in-job loopback PostgreSQL with Redis and
  Mailpit as service aliases

### Requirement: Product-build evidence stays required outside CI

The complete workspace build is checked by `production-build` in CI. PDF export,
release browser acceptance, and the read-back of a deployment on the cluster
MUST remain required acceptance evidence, collected outside GitLab CI and bound
to the exact source SHA. A passing `production-build` or the CI image-build job
is not that evidence, and neither waives it; release browser E2E MUST NOT be
reported as skipped-but-passing.

#### Scenario: Acceptance without outside-CI build evidence

- **WHEN** a candidate is proposed for `main` acceptance
- **THEN** the required PDF, browser, and deployment evidence exists for the exact source SHA, or acceptance fails

## ADDED Requirements

### Requirement: Secret scanning blocks on the tree and the full history

A blocking `secret-scan` job MUST run in every pipeline independently of earlier
jobs. It MUST scan the working tree and the complete, unshallowed Git history
reachable from the pipeline commit with a Gitleaks release binary verified by
SHA-256, MUST redact findings, and MUST fail closed on a shallow clone or a
finding. Allowlist entries MUST be reviewed synthetic or placeholder values
scoped by path and by value or commit. Before scanning the repository it MUST
prove with synthetic controls that a secret in HEAD and a history-only secret
both fail and a clean repository passes.

#### Scenario: A secret exists only in history

- **WHEN** a synthetic secret was committed and later removed
- **THEN** the history scan exits nonzero while the tree scan passes

#### Scenario: A secret is in the working tree

- **WHEN** a synthetic secret is present in HEAD
- **THEN** both scans exit nonzero and no secret value is printed

### Requirement: The dependency audit blocks high advisories in every pipeline

A single blocking `dependency-scan` job MUST run in every pipeline independently
of earlier jobs. It MUST fail on any production advisory and on any production
or development advisory of high or critical severity, and MUST fail when the
audit endpoint is unreachable. Exceptions MUST be limited to advisories
recorded in `dependency-vulnerability-scanning`.

#### Scenario: Synthetic high advisory

- **WHEN** the audit endpoint reports a high or critical advisory
- **THEN** the audit exits nonzero

#### Scenario: Audit endpoint unavailable

- **WHEN** the audit endpoint cannot be reached
- **THEN** the audit exits nonzero

### Requirement: A mutation pilot blocks the period transition owner

A blocking `mutation-period` job MUST run Stryker with the Vitest runner over
exactly `apps/api/src/modules/period/domain/period-transition.ts`, with
`perTest` coverage analysis, `concurrency` 1, in-place execution and a `break`
threshold of at least 70. Mutant workers MUST run only the pure unit suite and
MUST NOT start PostgreSQL, Redis or a browser.

#### Scenario: Score below the break threshold

- **WHEN** the mutation score is below 70
- **THEN** Stryker exits nonzero and the job fails

### Requirement: The production build is a blocking CI route

A blocking `production-build` job MUST run `pnpm build` under an explicit build
environment, MUST run the production-dist gates through the package builds, and
MUST write a manifest naming the commit SHA and the checksums of the built API,
shared and web outputs.

#### Scenario: Broken production build

- **WHEN** the production build or its dist gates fail
- **THEN** the pipeline fails and no manifest is produced
