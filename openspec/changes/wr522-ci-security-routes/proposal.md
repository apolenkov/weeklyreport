# Proposal

## Why

TASK-522 (assessment TASK-515) closes four engineering-maturity gaps in the
GitLab pipeline: no secret scanning, a non-blocking development audit that ran
only on schedule or manifest changes, no mutation testing, and no production
build in CI. The owner decisions of 2026-09-28 and 2026-10-01 kept production
builds outside CI; TASK-522 supersedes that part.

## What Changes

- `secret-scan`: checksum-verified Gitleaks over the tree and the full Git
  history in every pipeline, with synthetic controls and a reviewed allowlist.
- `dependency-scan`: one blocking audit of production and development
  dependencies in every pipeline; `dependency-scan-dev` is removed. The one
  unpatched advisory (braces, GHSA-vfj7-8cjw-p6xm) is accepted in writing.
- `mutation-period`: blocking Stryker+Vitest pilot of the period transition
  owner, break 70.
- `production-build`: blocking `pnpm build` with an explicit build environment
  and a SHA-bound manifest.
- ADR 0022 supersedes ADR 0019.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-merge-gate`: new blocking routes; production build moves into CI.
- `dependency-vulnerability-scanning`: records the braces acceptance.

## Impact

`.gitlab-ci.yml`, `.gitleaks.toml`, `scripts/gates/secret-scan.sh`,
`pnpm-workspace.yaml`, `apps/api/stryker.config.json`,
`apps/api/vitest.mutation.config.ts`, contract tests under
`scripts/gates/operations/`, and `docs/`.

## Non-goals

- Branch protection and the direct-to-`main` policy do not change (TASK-522 WR2).
- PDF export, release browser E2E and deployment read-back stay outside CI.
- Full mutation inventory and break 80 are a separate expansion; it needs an
  upstream fix for the Stryker 10 / Vitest 5 test-name filter or
  `coverageAnalysis: "all"`, because nested `describe` suites are not selected.
