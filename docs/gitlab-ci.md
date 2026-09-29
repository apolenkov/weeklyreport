# GitLab CI

`.gitlab-ci.yml` is the repository CI. It runs the repository lint/test gates, coverage jobs, the
disposable-database integration and reset lanes, and the scheduled/manual
dependency audit. Per the owner decision of 2026-09-28 it carries **only tests
and linters**: no Docker-in-Docker, no image builds, and no operational smoke.
The product build (`pnpm build`), Production Compose builds, PDF export, and
browser acceptance remain required evidence, collected outside CI as separate
checks — the `quality` job is therefore a lint/test lane, not a full
acceptance gate.

| GitLab job      | Execution                                                     |
| --------------- | ------------------------------------------------------------- |
| node-toolchain  | Node 26.8.1 container on the shared Docker runner             |
| quality         | Node 26.8.1 container on the shared Docker runner             |
| coverage        | Node 26.8.1 container on the shared Docker runner             |
| api-integration | pgvector 0.8.6/pg15 job container on the shared Docker runner |
| migrate-reset   | pgvector 0.8.6/pg15 job container on the shared Docker runner |
| dependency-scan | Schedule, manual, or MR changing lockfile/manifests           |

## Database-lane topology

The destructive guard (`prisma/guards/_destructive-guard.ts` →
`apps/api/src/infrastructure/prisma/e2e-destructive-target.ts`) accepts only an
exact loopback `DATABASE_URL`/`E2E_DATABASE_URL`. GitLab services on the Docker
executor are reachable through DNS aliases, never through the job container's
loopback, so a `postgres` service could not satisfy the guard without masking a
remote host as localhost — forbidden by the `destructive-db-guard` spec and by
the owner decision. The honest topology is:

- `api-integration` and `migrate-reset` run on the same pinned
  `pgvector/pgvector:0.8.6-pg15-bookworm` image.
  PostgreSQL starts inside the job container (`initdb` + `pg_ctl`)
  bound to `127.0.0.1` — a real in-job process, so the guarded
  `postgresql://…@127.0.0.1:5432/customreport_e2e` target is truthful. The
  `customreport` role is a superuser, the
  privilege `prisma migrate reset` needs to drop and recreate the database.
- The image carries no Node, curl, wget, or git, so the `node-toolchain` job
  downloads `node-v26.8.1-linux-x64.tar.gz` in the bookworm job image, verifies
  the pinned SHA-256, adds the `libatomic.so.1` that Node 26 links and the slim
  image lacks (copied from the same bookworm toolchain image), and passes one
  composite artifact to database jobs. `pnpm install --frozen-lockfile` needs
  no git inside the database image. Egress endpoints: the npm registry,
  Docker Hub, nodejs.org (`node-toolchain` tarball), and one
  github.com/docker/compose release fetch in `quality` — the latter is a
  digest-pinned `docker-compose` CLI used only to render the production
  Compose config in the compose gate, not a Compose smoke lane.
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
`package.json`, or `pnpm-workspace.yaml` also runs the audit. No dependency-update bot is configured (see
`docs/sdlc.md`); the audit job does not replace one. Runner assignment is a
GitLab setting, not declared in `.gitlab-ci.yml`.

## Contract-test coverage

Node and pnpm declarations in `.gitlab-ci.yml` are pinned in sync by
`lint:runtime-node`, including the toolchain tarball version. The mechanical
contract gates — `prod-compose-gate.test.ts`,
`operations-config-docs.test.ts`, and `vitest-reporting-contract.test.ts` —
assert `.gitlab-ci.yml` directly: reviewed external images are collected from `.gitlab-ci.yml` jobs and
services (adding the pinned Node image to `REVIEWED_EXTERNAL_IMAGES`), a
negative lock forbids Docker build/Compose smoke lanes, the single combined
API coverage contour and fail-closed `ci-reports` summary contract are
asserted, and the `quality` job is pinned as build-free with the product
build documented as outside-CI evidence. `DOCKER_COMPOSE_VERSION`/`SHA256`
have a single declaration site in `.gitlab-ci.yml` (the compose CLI exists
only for the render check), so the runtime-sync gate has nothing to pin them
against — the digest itself is the lock.
