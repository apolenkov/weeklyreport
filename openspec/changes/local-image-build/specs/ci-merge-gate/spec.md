# Delta specification for ci-merge-gate

## MODIFIED Requirements

### Requirement: GitLab CI builds and deploys with local pre-push checks

The repository MUST NOT build container images in GitLab CI. Container images (`api`, `migrate`, `web`, `backup`) MUST be built locally using `pnpm images:build` and pushed to the image registry tagged with the commit SHA.
Pipelines MUST be limited to same-project merge requests and default-branch pushes,
without duplicate branch pipelines. GitLab CI MUST run only `deploy-production` (and `pages` when configured).
`deploy-production` MUST verify upfront that all 4 required images (`api`, `migrate`, `web`, `backup`) tagged with `$CI_COMMIT_SHA` exist in the container registry before executing any Helm mutation, and MUST fail closed if any image is absent.
Local pre-push MUST include format, lint, typecheck, unit tests, specification validation, dependency audit and secret scanning.
`images:build` MAY run in pre-push hook only when explicitly enabled via `WR_IMAGES_ON_PUSH=1`.
Coverage, mutation and database integration/reset checks MUST remain available
as documented local commands, with the existing destructive target guards.

#### Scenario: A pipeline is created

- **WHEN** a same-project merge request or default-branch push creates a pipeline
- **THEN** it does not contain a `build-images` job
- **AND** it contains only manual deployment when configured with KUBECONFIG
- **AND** deployment verifies registry image existence for the pipeline commit SHA before mutating the cluster

#### Scenario: Local verification

- **WHEN** a candidate is prepared for push
- **THEN** the local checks execute and failures block delivery
- **AND** an agent or CI hook skip is not evidence that checks passed

### Requirement: Release image coordinates have one committed source

`deploy/images/release.env` MUST be the only source of the release image registry (`IMAGE_REGISTRY`) and build platform (`IMAGE_PLATFORM`). Environment variables, CI variables and CLI options MUST NOT override either value, and no literal fallback MAY supply one. `pnpm images:build` MUST read both values from that file and MUST refuse before any git, Docker or registry call when the file is missing or a value is empty. `pnpm images:build` MUST pass `--platform` set to `IMAGE_PLATFORM` for all four images and MUST confirm after each push that the registry index of the image lists that platform. `deploy-production` MUST read the registry from the same file, MUST verify the four manifests under that registry, and MUST pass the same value to Helm as `images.registry`. `deploy-production` MUST refuse before any registry request or Helm call when the file, the registry or the registry credentials are unset.

#### Scenario: Release file is missing or incomplete

- **WHEN** `deploy/images/release.env` is absent, or `IMAGE_REGISTRY` or `IMAGE_PLATFORM` is empty
- **THEN** `pnpm images:build` exits with a message naming the file before any git, Docker or registry call
- **AND** `deploy-production` exits before any curl or Helm call

#### Scenario: Check and release use one registry

- **WHEN** `deploy-production` runs with a `IMAGE_REGISTRY` variable that differs from the committed file
- **THEN** the manifest checks and `--set images.registry` both use the committed value
- **AND** no image is checked under one registry and installed from another

#### Scenario: Pushed image lacks the release platform

- **WHEN** a pushed image's registry index does not list `IMAGE_PLATFORM`
- **THEN** `pnpm images:build` fails naming the image and the missing platform

## REMOVED Requirements

### Requirement: The image-build job fails closed and uses no Docker daemon

The image-build job is removed from GitLab CI. Images are built locally via `pnpm images:build` on Mac and pushed prior to deployment.
