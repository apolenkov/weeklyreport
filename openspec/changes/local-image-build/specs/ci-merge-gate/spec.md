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

## REMOVED Requirements

### Requirement: The image-build job fails closed and uses no Docker daemon

The image-build job is removed from GitLab CI. Images are built locally via `pnpm images:build` on Mac and pushed prior to deployment.
