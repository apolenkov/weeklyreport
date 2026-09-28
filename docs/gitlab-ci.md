# GitLab CI migration candidate

`.gitlab-ci.yml` mirrors the repository lint/test gates, coverage jobs, the
disposable-database integration and reset lanes, and the scheduled/manual
dependency audit. Per the owner decision of 2026-09-28 it carries **only tests
and linters**: no Docker-in-Docker, no image builds, and no operational smoke.
The product build (`pnpm build`), Production Compose builds, PDF export, and
browser acceptance remain required evidence, collected outside CI as separate
checks — the `quality` job is therefore a lint/test subset of its GitHub
counterpart, not a full mirror.

| GitLab job      | Existing workflow                   | Execution                                       |
| --------------- | ----------------------------------- | ----------------------------------------------- |
| node-toolchain  | —                                   | Node 26.8.1 container on runner 342             |
| quality         | CI quality                          | Node 26.8.1 container on runner 342             |
| coverage        | CI coverage                         | Node 26.8.1 container on runner 342             |
| api-integration | CI api-integration                  | pgvector 0.8.6/pg15 job container on runner 342 |
| migrate-reset   | CI migrate-reset                    | pgvector 0.8.6/pg15 job container on runner 342 |
| dependency-scan | Dependency Vulnerability Scan audit | Schedule or manual pipeline                     |

## Database-lane topology

The destructive guard (`prisma/guards/_destructive-guard.ts` →
`apps/api/src/infrastructure/prisma/e2e-destructive-target.ts`) accepts only an
exact loopback `DATABASE_URL`/`E2E_DATABASE_URL`. GitLab services on the Docker
executor are reachable through DNS aliases, never through the job container's
loopback, so a `postgres` service could not satisfy the guard without masking a
remote host as localhost — forbidden by the `destructive-db-guard` spec and by
the owner decision. The honest topology is:

- `api-integration` and `migrate-reset` run on the same pinned
  `pgvector/pgvector:0.8.6-pg15-bookworm` image the GitHub lane uses as a
  service. PostgreSQL starts inside the job container (`initdb` + `pg_ctl`)
  bound to `127.0.0.1` — a real in-job process, so the guarded
  `postgresql://…@127.0.0.1:5432/customreport_e2e` target is truthful. The
  `customreport` role is a superuser, matching the GitHub `POSTGRES_USER`
  privilege `prisma migrate reset` needs to drop and recreate the database.
- The image carries no Node, curl, wget, or git, so the `node-toolchain` job
  downloads `node-v26.8.1-linux-x64.tar.gz` in the bookworm job image, verifies
  the pinned SHA-256, adds the `libatomic.so.1` that Node 26 links and the slim
  image lacks (copied from the same bookworm toolchain image), and passes one
  composite artifact to database jobs. `pnpm install --frozen-lockfile` needs
  no git inside the database image. No new egress endpoint is required beyond
  the existing npm registry, Docker Hub, and nodejs.org fetch in
  `node-toolchain`.
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
dependency audit. The dependency update bot has a separate hosting migration
(`renovate.json`, see `gitlab-hosting.md`) and is not replaced by the audit
job.

## Contract-test coverage gap (updated for the tests+linters form)

Node and pnpm declarations in `.gitlab-ci.yml` are pinned in sync by
`lint:runtime-node`, including the toolchain tarball version. The remaining
mechanical contract gates — `prod-compose-gate.test.ts`,
`operations-config-docs.test.ts`, and `vitest-reporting-contract.test.ts` —
still parse only `.github/workflows/ci.yml`. The candidate no longer
duplicates the Compose/release-identity content those gates assert (the
coverage-evidence artifact names and the combined API coverage contour are
preserved), so the residual gap is that the GitLab file is not parsed by those
contract tests at all. Retiring or retargeting them is required before the
final GitLab cutover. This is a recorded open gap, not a waiver: the GitHub
workflow stays authoritative until it is closed.
