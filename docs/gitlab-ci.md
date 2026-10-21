# GitLab CI

Owner decision 2026-10-20, confirmed 2026-10-21 (TASK-622): GitLab only builds
images and deploys. Checks run locally. Pipelines are limited to same-project
merge requests and default-branch pushes; schedules, tags, web/API starts and
ordinary branch pushes do not create pipelines. Merge requests offer image
builds manually and do not deploy.

## Job destinations

| Former job        | Where it runs now                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node-toolchain    | Removed CI-only artifact transport; local Node from `.nvmrc`, pnpm from `package.json`; Dockerfiles still own image toolchains.                                |
| quality           | `pnpm check:push` in Lefthook pre-push: format, lint, typecheck, tests and spec validation. Commitlint remains the commit-msg hook.                            |
| dependency-scan   | `pnpm audit:dependencies` in pre-push, preserving production audit and high-severity full audit. Endpoint failure blocks verification.                         |
| secret-scan       | `pnpm scan:secrets` in pre-push: existing Gitleaks tree/history scan with redaction and synthetic positive/negative controls. Install Gitleaks before pushing. |
| mutation-period   | `pnpm test:mutation` on demand; existing serial Stryker pilot and threshold unchanged.                                                                         |
| coverage          | `pnpm --filter @weeklyreport/web test:coverage` on demand.                                                                                                     |
| api-integration   | `pnpm test:coverage` runs combined API unit/integration coverage once then Web coverage; `pnpm test:integration` offers integration-only checks.               |
| migrate-reset     | `pnpm db:migrate:reset` on demand: guarded reset followed by explicit full seed.                                                                               |
| production-build  | `pnpm build` is required local acceptance evidence. Image builds use Dockerfiles directly and never consumed this job's artifacts.                             |
| renovate          | Operator-triggered local container command below; no scheduled update job in CI.                                                                               |
| build-images      | GitLab, unchanged four SHA-tagged api/migrate/web/backup images and `image-digests.txt` (30 days).                                                             |
| deploy-production | GitLab, unchanged conditional manual production deployment.                                                                                                    |

## Local verification

Run `pnpm install --frozen-lockfile` and
`pnpm --filter @weeklyreport/api db:generate` with an explicit generation-only
DATABASE_URL. Keep that explicit value exported for `pnpm check:push`: mocked
Prisma seed tests require it even though they never connect to a database.
For an isolated checkout without local environment files:

```sh
export DATABASE_URL=postgresql://weeklyreport:localdev@127.0.0.1:5432/weeklyreport_generate_only
export API_URL=http://127.0.0.1:3002
pnpm --filter @weeklyreport/api db:generate
pnpm check:push
```

Install Helm for chart contract tests and Gitleaks for scanning.
Run `pnpm check:push` and `pnpm build`, recording the source SHA, command, exit
status and logs in the external handoff evidence directory. Existing CI/agent
hook skips remain unchanged; a skipped hook is **NOT VERIFIED**. Agents must run
`pnpm check:push` explicitly before publishing.

On the owner's shared host, use `run-checks <worktree> 'pnpm check:push'` so the
existing global pre-push semaphore covers the whole check. Other machines must
coordinate heavy checks with their resource owner. Coverage, mutation and DB
checks are deliberately excluded from every push.

Before each database-backed phase, coordinate the exact synthetic target with
other sessions, print its credential-masked address, verify the destructive
guard, set `NODE_ENV=test` and per-command
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=давай`, then run
`pnpm db:migrate:reset` against that same target. Supply matching DATABASE_URL
and E2E_DATABASE_URL explicitly, Redis DB15 for the main target (lane a/b use
DB1/2), and reachable Postgres/Redis/Mailpit. Follow [AGENTS.md](../AGENTS.md) and
[README.md](../README.md); localhost alone does not authorize a reset.

Coverage thresholds and Vitest JSON reporting remain intact. Use
`VITEST_JSON_OUTPUT_FILE` with an absolute external evidence path for per-suite
JSON; native coverage summaries remain under each app's coverage directory.
The old CI Markdown summaries, production-build checksum manifest and temporary
Node tarball are no longer produced or uploaded. Preserve local logs, native
coverage reports and exact SHA instead; they are not GitLab artifacts.

Renovate remains configured by `renovate.json`. With operator-provided
RENOVATE_TOKEN in the environment (never print it), run the former pinned image:

```sh
docker run --rm -e RENOVATE_TOKEN -e RENOVATE_PLATFORM=gitlab \
  -e RENOVATE_ENDPOINT=https://forge.example.com/api/v4 \
  -e RENOVATE_ONBOARDING=false \
  -v "$PWD/renovate.json:/usr/src/app/renovate.json:ro" \
  renovate/renovate:44.155.2@sha256:93e8dc64410276bb44854b4f6fce2306f8fe24c87301d558a920381130b30851 \
  example/weeklyreport
```

This creates external dependency MRs and is an explicit operator action, never
a pre-push side effect. No GitLab project setting or schedule is changed here.

## Build and deployment

Both retained jobs use `img-build`, `interruptible: false` and their existing
resource groups. BuildKit stays rootless and daemonless with
`BUILDKITD_FLAGS=--oci-worker-no-process-sandbox`. Registry and web build inputs
remain fail-closed. The image job runs automatically on default-branch pushes
when configured and otherwise remains manual and non-blocking. The four image
outputs, digest artifact and production environment are unchanged.

`deploy-production` exists only when a file-type `KUBECONFIG` variable is set and
needs the variables `HELM_VALUES_FILE` (file), `HELM_NAMESPACE` and
`HELM_KUBE_CONTEXT`; it fails before any Helm call if one is missing. It looks the
release up in that context and namespace: only Helm's own release-not-found error
from `helm history` counts as no release → `helm install --wait=watcher`; a
`deployed` release → `helm upgrade --wait=watcher` (never `--install`). A history
error, a successful history with no readable revision, an inconsistent answer or a
release in another state stops the job. There is no automatic rollback: a failed
install keeps the release and its volume claims, and an upgrade is fixed forward
because CI cannot prove schema compatibility. See `docs/kubernetes.md`.

PDF export, browser acceptance and deployment read-back remain separate
required evidence. Successful image publication proves none of those checks.
