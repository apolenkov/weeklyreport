## RENAMED Requirements

- FROM: `### Requirement: GitLab CI carries lint and test lanes and a gated image build`
- TO: `### Requirement: GitLab CI builds and deploys with local pre-push checks`
- FROM: `### Requirement: CI does not depend on local hooks`
- TO: `### Requirement: Local checks are reproducible without GitLab`

## MODIFIED Requirements

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

### Requirement: Local checks are reproducible without GitLab

The repository MUST expose local check commands through package scripts and
Lefthook. A clean developer checkout with the documented toolchain MUST be able
to execute them without a GitLab runner. Expensive database checks MUST require
an explicitly configured, coordinated, guard-approved disposable target.

#### Scenario: A developer verifies a candidate

- **WHEN** the documented local checks are run
- **THEN** their exit status and exact source SHA are recorded independently of CI

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
