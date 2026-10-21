# ci-merge-gate Specification

## Purpose

Define the local verification and GitLab build/deploy gates for `main` and the acceptance evidence that
must be collected outside CI.

## Requirements

### Requirement: GitLab CI builds and deploys with local pre-push checks

The repository MUST run only build-images and deploy-production in GitLab CI.
Pipelines MUST be limited to same-project merge requests and default-branch pushes,
without duplicate branch pipelines. Local pre-push MUST include format, lint,
typecheck, unit tests, specification validation, dependency audit and secret scanning.
Coverage, mutation and database integration/reset checks MUST remain available
as documented local commands, with the existing destructive target guards.

#### Scenario: A pipeline is created

- **WHEN** a same-project merge request or default-branch push creates a pipeline
- **THEN** it contains only the image build and, when configured, manual deployment
- **AND** it uses img-build runners and preserves non-interruptible build/deploy resource groups

#### Scenario: Local verification

- **WHEN** a candidate is prepared for push
- **THEN** the local checks execute and failures block delivery
- **AND** an agent or CI hook skip is not evidence that checks passed

### Requirement: Product-build evidence stays required outside CI

The complete workspace build (`pnpm build`), PDF export, browser acceptance, and
the read-back of a deployment on the cluster MUST remain required acceptance
evidence, collected outside GitLab CI and bound to the exact source SHA. The CI
image-build job produces images; it is not that evidence, and its absence or
success does not waive them.

#### Scenario: Acceptance without outside-CI build evidence

- **WHEN** a candidate is proposed for `main` acceptance
- **THEN** the required build, PDF, browser, and deployment evidence exists for the exact source SHA, or acceptance fails

### Requirement: Local checks are reproducible without GitLab

The repository MUST expose local check commands through package scripts and
Lefthook. A clean developer checkout with the documented toolchain MUST be able
to execute them without a GitLab runner. Expensive database checks MUST require
an explicitly configured, coordinated, guard-approved disposable target.

#### Scenario: A developer verifies a candidate

- **WHEN** the documented local checks are run
- **THEN** their exit status and exact source SHA are recorded independently of CI

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

### Requirement: The image-build job fails closed and uses no Docker daemon

The image-build job MUST use rootless BuildKit pinned by `tag@sha256:` digest
without Docker-in-Docker or a mounted Docker socket. It MUST push to the registry
named by `IMAGE_REGISTRY` when set, otherwise to `$CI_REGISTRY_IMAGE`, with
`IMAGE_REGISTRY_USER` and `IMAGE_REGISTRY_PASSWORD` when set, otherwise the job
token credentials, and MUST fail before building when the resolved registry,
user, or password is empty, or any `WR_NEXT_PUBLIC_*` value `Dockerfile.web`
requires is unset. It MUST use no keyword newer than the instance's GitLab
version (15.10). It MUST run automatically on default-branch push pipelines
once the web build variables are configured, be manual and non-blocking before
that, and be manual and non-blocking on merge requests. It MUST tag each pushed image with the commit SHA,
publish the resulting digests as a job artifact, and never print registry
credentials.

#### Scenario: Registry variables are missing

- **WHEN** the job runs with neither `IMAGE_REGISTRY` nor `$CI_REGISTRY_IMAGE` available, or a required `WR_NEXT_PUBLIC_*` value unset
- **THEN** it fails in its first script step with a message naming the variable
- **AND** no build starts

#### Scenario: Merge request pipeline

- **WHEN** a merge-request pipeline is created
- **THEN** the image-build job is manual and its absence of a run does not fail the pipeline

#### Scenario: Images are built from the pinned toolchain

- **WHEN** the job runs
- **THEN** it builds `api`, `migrate`, `web`, and `backup` from the repository Dockerfiles with no Docker daemon
- **AND** the job image is listed in the reviewed external-image set

### Requirement: Cluster deployment is manual and gated on a supplied kubeconfig

A deploy job MAY exist only as `when: manual` on the default branch, MUST be
defined only when a file-type `KUBECONFIG` variable is set, and MUST run
`helm upgrade --install` with `--atomic` (which waits for readiness) and a values file supplied by CI
variable. The repository MUST NOT contain cluster credentials, and MUST NOT
assume Argo CD.

#### Scenario: No kubeconfig supplied

- **WHEN** `KUBECONFIG` is not set
- **THEN** the pipeline contains no deploy job

#### Scenario: Manual deploy

- **WHEN** an operator starts the deploy job on the default branch
- **THEN** it installs or upgrades the release with the commit-SHA image tag and rolls back on failure
