# GitHub Actions runs the checks on GitHub

**Status:** accepted
**Date:** 2026-11-22
**Superseded-by:** None

## Context

ADR 0023 moved lint, tests and audits to the local pre-push gate so that the
shared GitLab runner served only builds and deployment. On 2026-11-19 the
repository moved to github.com/apolenkov/weeklyreport and the GitLab project
was deleted. There is no shared runner to protect any more, and the owner wants
every public repository to show a green CI (TASK-919, 2026-11-22).

## Decision

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request, on `ubuntu-latest`: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck` and `pnpm test`. The local pre-push gate stays as it is: it
also covers the build, OpenSpec, audits, secret scanning and the database
checks. ADR 0023 still describes `.gitlab-ci.yml`, which only matters for a
GitLab-hosted deployment.

## Consequences

Reviewers see the check status on the pull request without a local run.
Database integration tests, coverage, mutation and E2E remain explicit local
commands.
