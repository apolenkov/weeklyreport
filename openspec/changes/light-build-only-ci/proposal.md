# Proposal

## Why

Shared GitLab capacity must serve image builds and deployment, while local checks catch defects before push (owner decision 2026-10-20, confirmed 2026-10-21; TASK-622).

## What Changes

- Keep only build-images and deploy-production in CI, preserving image outputs and deployment behavior.
- Move lint, tests, audit and secret scanning into local pre-push; retain expensive coverage, mutation and database checks as explicit local commands.
- Document every removed job and update its contract tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- ci-merge-gate: build/deploy CI with local acceptance checks.
- dependency-vulnerability-scanning: move audits to local pre-push.
- test-evidence-integrity: preserve explicit local integration and coverage evidence.
- role-coverage-gate: execute the existing reference-identity gate locally before push.

## Impact

.gitlab-ci.yml, lefthook.yml, package scripts, CI contract tests, runtime pin gate and operations documentation. No application behavior changes.

## Non-goals

No deployment, merge, project settings changes, database mutation or dependency upgrade campaign.
