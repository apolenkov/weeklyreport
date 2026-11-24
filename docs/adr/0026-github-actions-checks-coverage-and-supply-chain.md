# GitHub Actions checks coverage and the supply chain

**Status:** accepted
**Date:** 2026-11-24
**Superseded-by:** None

## Context

[ADR 0025](0025-github-actions-runs-checks.md) brought the standard checks to
GitHub. Vitest coverage and several supply-chain checks still required a local
run. The [OpenSpec change](../../openspec/changes/showcase-repository-quality/proposal.md)
defines the checks that public contributors should see on GitHub.

## Decision

CI runs three independent jobs. The checks job preserves the format, lint,
typecheck, and test commands. Coverage uses disposable PostgreSQL with pgvector,
Redis DB 15, and Mailpit on a GitHub-hosted runner. It applies the guarded reset
and an explicit seed before running the existing API and web coverage command.
The job uploads LCOV and JSON summaries.

The supply-chain job validates OpenSpec, runs the existing Gitleaks scan with
full reachable Git history, and audits dependencies. CodeQL and OpenSSF
Scorecard use separate workflows with scoped publishing permissions.

## Alternatives

Unit-only API coverage would skip integration tests of persistence, queues, and
mail. Running the existing combined coverage suite keeps the configured
coverage scope and thresholds.

## Consequences

Coverage depends on the service images listed in
[the workflow](../../.github/workflows/ci.yml) and the matching local versions
in [the development manifest](../../deploy/local-dev/deps.yaml). Pre-push keeps
its existing checks. Production builds, mutation testing, and browser E2E
remain on-demand commands. GitLab remains an optional deployment route.
