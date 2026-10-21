# CI builds and deploys; checks run locally

**Status:** accepted by owner, implementation proposed in TASK-622
**Date:** 2026-10-21

The owner decided on 2026-10-20 that CI serves only builds and deployment,
and confirmed the WeeklyReport change on 2026-10-21. Shared GitLab capacity
must not be spent on verification lanes. This supersedes ADR 0022 for CI
scope: lint, tests, audit and secret scanning move to local pre-push; coverage,
mutation and database checks remain explicit local commands. Image production
and manual deployment remain unchanged. Hook skips are not passing evidence.
See [the job destination table](../gitlab-ci.md) and
[the OpenSpec change](../../openspec/changes/light-build-only-ci/proposal.md).
