## RENAMED Requirements

- FROM: `### Requirement: GitLab CI carries only lint and test lanes`
- TO: `### Requirement: GitLab CI carries lint and test lanes and a gated image build`

## MODIFIED Requirements

### Requirement: GitLab CI carries lint and test lanes and a gated image build

Per the owner decisions of 2026-09-28 and 2026-10-01, `.gitlab-ci.yml` MUST run
the lint and test lanes `node-toolchain`, `quality`, `coverage`,
`api-integration`, and `migrate-reset` on push pipelines, plus `dependency-scan`
on schedule and manual pipelines and on merge requests that change
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, or any `package.json`. It MAY run one
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

The complete workspace build (`pnpm build`), PDF export, browser acceptance, and
the read-back of a deployment on the cluster MUST remain required acceptance
evidence, collected outside GitLab CI and bound to the exact source SHA. The CI
image-build job produces images; it is not that evidence, and its absence or
success does not waive them.

#### Scenario: Acceptance without outside-CI build evidence

- **WHEN** a candidate is proposed for `main` acceptance
- **THEN** the required build, PDF, browser, and deployment evidence exists for the exact source SHA, or acceptance fails

## ADDED Requirements

### Requirement: The image-build job fails closed and uses no Docker daemon

The image-build job MUST use rootless BuildKit pinned by `tag@sha256:` digest
without Docker-in-Docker or a mounted Docker socket. It MUST push to the registry
named by the CI variables `IMAGE_REGISTRY`, `IMAGE_REGISTRY_USER`, and
`IMAGE_REGISTRY_PASSWORD`, never to `$CI_REGISTRY`, and MUST fail before building
when any of them, or any `WR_NEXT_PUBLIC_*` value `Dockerfile.web` requires, is
unset. It MUST run on default-branch and tag pipelines and MUST be manual and
non-blocking on merge requests. It MUST tag each pushed image with the commit SHA,
publish the resulting digests as a job artifact, and never print registry
credentials.

#### Scenario: Registry variables are missing

- **WHEN** the job runs with `IMAGE_REGISTRY` unset
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
`helm upgrade --install` with `--atomic --wait` and a values file supplied by CI
variable. The repository MUST NOT contain cluster credentials, and MUST NOT
assume Argo CD.

#### Scenario: No kubeconfig supplied

- **WHEN** `KUBECONFIG` is not set
- **THEN** the pipeline contains no deploy job

#### Scenario: Manual deploy

- **WHEN** an operator starts the deploy job on the default branch
- **THEN** it installs or upgrades the release with the commit-SHA image tag and rolls back on failure of `--wait`
