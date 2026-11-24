# GitHub Actions runs the checks on GitHub

**Status:** superseded
**Date:** 2026-11-22
**Superseded-by:** [0026-github-actions-checks-coverage-and-supply-chain](0026-github-actions-checks-coverage-and-supply-chain.md)

## Context

ADR 0023 moved lint, tests and audits to the local pre-push gate so that the
shared GitLab runner served only builds and deployment. On 2026-11-19 the
repository moved to github.com/apolenkov/weeklyreport and the GitLab project
was deleted. There is no shared runner to protect any more, and the owner wants
every public repository to show a green CI (TASK-919, 2026-11-22).

## Decision

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request, on `ubuntu-latest`: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck` and `pnpm test`. The local pre-push gate stays as it is:
`pnpm check:push` runs the same four commands plus `pnpm spec:check`
(OpenSpec), `pnpm audit:dependencies` and `pnpm scan:secrets`. Commit messages
are checked locally by the `commit-msg` hook (commitlint); CI does not repeat
it.

ADR 0019, 0022 and 0023 described CI on the GitLab runner. This ADR supersedes
their CI scope. `.gitlab-ci.yml` and `.gitlab/` remain only as the deployment
pipeline for a GitLab-hosted installation; nothing on GitHub runs them.

## Consequences

Reviewers see the check status on the pull request without a local run.
The production build, database integration tests, coverage, mutation and E2E
remain explicit local commands.
