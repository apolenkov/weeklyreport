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

The image-build job MUST build with buildah pinned by `tag@sha256:` digest from
the internal mirror, without Docker-in-Docker, a mounted Docker socket or
privileged job capabilities, and MUST run with the vfs storage driver and chroot
isolation. It MUST pull every external base image through the internal Docker Hub
mirror by rewriting the repository Dockerfiles' `FROM` references into a
job-local copy, and MUST fail before building, naming it, when an external base
image is not mirrored. The repository Dockerfiles MUST keep their upstream `tag@sha256:`
references. Built and pushed images MUST use the Docker v2 manifest format so
`HEALTHCHECK` survives. It MUST push to the registry named by `IMAGE_REGISTRY`
when set, otherwise to `$CI_REGISTRY_IMAGE`, with `IMAGE_REGISTRY_USER` and
`IMAGE_REGISTRY_PASSWORD` when set, otherwise the job token credentials, and
MUST fail before building when the resolved registry, user, or password is empty,
or any `WR_NEXT_PUBLIC_*` value `Dockerfile.web` requires is unset. It MUST keep
registry credentials in a job-local auth file outside `$CI_PROJECT_DIR` and never
print them. It MUST use no keyword newer than the instance's GitLab version
(15.10). It MUST be manual and non-blocking on default-branch, tag and
merge-request pipelines. It MUST tag each pushed image with the commit SHA and
publish the resulting digests as a job artifact.

#### Scenario: Registry variables are missing

- **WHEN** the job runs with neither `IMAGE_REGISTRY` nor `$CI_REGISTRY_IMAGE` available, or a required `WR_NEXT_PUBLIC_*` value unset
- **THEN** it fails in its first script step with a message naming the variable
- **AND** no build starts

#### Scenario: Merge request pipeline

- **WHEN** a merge-request pipeline is created
- **THEN** the image-build job is manual and its absence of a run does not fail the pipeline

#### Scenario: Images are built from the pinned toolchain

- **WHEN** the job runs
- **THEN** it builds `api`, `migrate`, `web`, and `backup` from the repository Dockerfiles through the internal mirror with buildah and no Docker daemon
- **AND** the job image is a digest-pinned buildah image listed in the reviewed external-image set
- **AND** each image is tagged with the commit SHA and its digest is recorded in `image-digests.txt`
