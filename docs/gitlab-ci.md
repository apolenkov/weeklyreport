# GitLab CI

`.gitlab-ci.yml` is the repository CI. It runs the repository lint/test gates, coverage jobs, the
disposable-database integration and reset lanes, and the scheduled/manual
dependency audit. Per the owner decision of 2026-09-28 it carries tests
and linters; since the owner decision of 2026-10-01 it also has one gated image
build (`build-images`, rootless BuildKit) and an optional manual deploy job. There is
no Docker-in-Docker and no operational smoke. The product build (`pnpm build`),
PDF export, browser acceptance, and the read-back of a deployment remain
required evidence, collected outside CI as separate checks — the `quality` job
is therefore a lint/test lane, not a full acceptance gate. The GitLab instance
is 15.10, so `.gitlab-ci.yml` uses no keyword introduced after 15.10.

| GitLab job          | Execution                                                            |
| ------------------- | -------------------------------------------------------------------- |
| node-toolchain      | Node 26.10.0 container on the shared Docker runner                   |
| quality             | Node 26.10.0 container on the shared Docker runner                   |
| coverage            | Node 26.10.0 container on the shared Docker runner                   |
| api-integration     | pgvector 0.8.7/pg15 job container on the shared Docker runner        |
| migrate-reset       | pgvector 0.8.7/pg15 job container on the shared Docker runner        |
| dependency-scan     | Schedule, manual, or MR changing lockfile/manifests                  |
| dependency-scan-dev | Same rules as dependency-scan; `allow_failure: true`                 |
| renovate            | Schedule, web, or API pipeline with `RENOVATE_TOKEN` set; no `needs` |
| build-images        | Rootless BuildKit; default branch and tags, manual on MRs            |
| deploy-production   | Manual, default branch, only when `KUBECONFIG` is set                |

## Renovate

The `renovate` job opens weekly dependency MRs from `renovate.json`. It runs only
when the masked CI/CD variable `RENOVATE_TOKEN` (project access token, scope
`api`) is set. The weekly cadence is a GitLab pipeline schedule (Build > Pipeline
schedules, weekly, cron in the instance time zone); `renovate.json` holds no
schedule, so a manual run is never silently skipped.

## Image build and deploy

`build-images` builds `api`, `migrate`, `web`, and `backup` with
`moby/buildkit:v0.33.1-rootless` (digest-pinned, no Docker daemon or socket) and
pushes them tagged with the commit SHA to `$CI_REGISTRY_IMAGE`. `IMAGE_REGISTRY`,
`IMAGE_REGISTRY_USER`, and `IMAGE_REGISTRY_PASSWORD` override the registry and
credentials; the job fails in its first step when the resolved registry, user,
or password is empty, or when a `WR_NEXT_PUBLIC_*` value that `Dockerfile.web`
compiles in is unset. It runs automatically on the default branch and on tags
when the single CI variable `WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING` is set —
the only variable the rule evaluates — and is a manual, non-blocking job
otherwise and on merge requests. The digests are the artifact `image-digests.txt`. The job sets
`BUILDKITD_FLAGS=--oci-worker-no-process-sandbox`, the job-side mitigation
for a runner whose default seccomp/AppArmor profile denies rootless
buildkitd its worker sandbox (`mount proc: operation not permitted`); the
alternative is a runner configured with seccomp, AppArmor, and system paths
unconfined. Whether the project runner then permits the build is not
verified — the first run decides.

`deploy-production` runs `helm upgrade --install --atomic` with a values file
from the file-type variable `HELM_VALUES_FILE` and `HELM_NAMESPACE`, and exists
only when a file-type `KUBECONFIG` variable is set. See `docs/kubernetes.md`.

## Database-lane topology

The destructive guard (`prisma/guards/_destructive-guard.ts` →
`apps/api/src/infrastructure/prisma/e2e-destructive-target.ts`) accepts only an
exact loopback `DATABASE_URL`/`E2E_DATABASE_URL`. GitLab services on the Docker
executor are reachable through DNS aliases, never through the job container's
loopback, so a `postgres` service could not satisfy the guard without masking a
remote host as localhost — forbidden by the `destructive-db-guard` spec and by
the owner decision. The honest topology is:

- `api-integration` and `migrate-reset` run on the same pinned
  `pgvector/pgvector:0.8.7-pg15-bookworm` image.
  PostgreSQL starts inside the job container (`initdb` + `pg_ctl`)
  bound to `127.0.0.1` — a real in-job process, so the guarded
  `postgresql://…@127.0.0.1:5432/customreport_e2e` target is truthful. The
  `customreport` role is a superuser, the
  privilege `prisma migrate reset` needs to drop and recreate the database.
- The image carries no Node, curl, wget, or git, so the `node-toolchain` job
  downloads `node-v26.10.0-linux-x64.tar.gz` in the bookworm job image, verifies
  the pinned SHA-256, adds the `libatomic.so.1` that Node 26 links and the slim
  image lacks (copied from the same bookworm toolchain image), and passes one
  composite artifact to database jobs. `pnpm install --frozen-lockfile` needs
  no git inside the database image. Egress endpoints: the npm registry,
  Docker Hub, nodejs.org (`node-toolchain` tarball), and get.helm.sh in
  `quality`. The checksum-pinned `helm` CLI only renders and validates the chart;
  it is not a cluster smoke lane.
- `api-integration` also declares `services:` for Redis (`redis` alias) and
  Mailpit (`mailpit` alias). Neither is guard-constrained; the suite reads the
  real hostnames (`REDIS_HOST=redis`, `SMTP_HOST=mailpit`,
  `MAILPIT_API_URL=http://mailpit:8025`). `REDIS_DB=15` is preserved.
- The earlier isolated-shell-runner + Compose design and the DinD runtime
  smoke are retired by the 2026-09-28 owner decision; the
  `weeklyreport-ci-isolated` runner prerequisite no longer applies.

`migrate-reset` runs the guarded `prisma migrate reset` plus the canonical
`full` seed against its own in-job cluster, keeping the reset gate independent
of the integration suite's data.

## Schedule and manual pipeline

The weekly dependency scan uses a GitLab schedule for the default branch at
Monday 06:00 UTC; create that schedule after the main cutover. A manually
started pipeline (`CI_PIPELINE_SOURCE=web`) runs the full lane set plus the
dependency audit. A merge request that changes `pnpm-lock.yaml`, a
`package.json`, or `pnpm-workspace.yaml` also runs the audit. `dependency-scan` blocks on `pnpm audit --prod`; the separate
`dependency-scan-dev` job runs `pnpm audit --dev --audit-level high` with
`allow_failure: true`, so development-tool advisories show as a pipeline
warning instead of being hidden. No dependency-update bot is configured, because it would need
an owner-provisioned token on the private GitLab (see `docs/sdlc.md`); the
audit job does not replace one. Runner assignment is a
GitLab setting, not declared in `.gitlab-ci.yml`.

## Contract-test coverage

Node and pnpm declarations in `.gitlab-ci.yml` are pinned in sync by
`lint:runtime-node`, including the toolchain tarball version. The mechanical
contract gates — the CI/image gates under `scripts/gates/operations/`,
`operations-config-docs.test.ts`, and `vitest-reporting-contract.test.ts` —
assert `.gitlab-ci.yml` directly: reviewed external images are collected from `.gitlab-ci.yml` jobs and
services (adding the pinned Node image to `REVIEWED_EXTERNAL_IMAGES`), a
negative lock forbids Docker build/Compose smoke lanes, the single combined
API coverage contour and fail-closed `ci-reports` summary contract are
asserted, and the `quality` job is pinned as build-free with the product
build documented as outside-CI evidence. The Helm CLI version and download
checksum have one declaration site in `.gitlab-ci.yml`; production chart
validation needs no Docker daemon or Compose CLI.
