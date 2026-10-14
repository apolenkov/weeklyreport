# CI runs security, mutation and production-build routes

**Status:** accepted
**Date:** 2026-10-15
**Superseded-by:** None

## Context

[ADR 0019](0019-gitlab-is-the-only-remote-and-ci-runs-lint-and-test-only.md)
kept CI to lint and test lanes. The TASK-515 assessment found missing secret
scanning, a non-blocking development audit, no mutation testing and no
production build in CI; TASK-522 asks to close them. The shared Docker runner
still has no Docker-in-Docker.

## Decision

`.gitlab-ci.yml` adds four blocking routes that need no privileged runner:
`secret-scan`, a single `dependency-scan` over production and development
dependencies, `mutation-period` and `production-build`. PDF export, release
browser acceptance and deployment read-back remain outside CI as separate
explicit evidence. The direct-to-`main` policy of 2026-10-11 is unchanged.

## Alternatives

- Keep the production build outside CI: rejected, a broken build then reaches
  `main` unnoticed until a local run.
- Mutation over the full API: rejected for now, a one-owner pilot at break 70
  is the bounded first step.

## Consequences

Pipelines run four more jobs on the single runner. Requirements live in
`ci-merge-gate` and `dependency-vulnerability-scanning`.
