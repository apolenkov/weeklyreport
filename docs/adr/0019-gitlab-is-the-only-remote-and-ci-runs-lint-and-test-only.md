# GitLab is the only remote and CI runs lint and test lanes only

**Status:** accepted
**Date:** 2026-09-28
**Superseded-by:** None

## Context

The repository moved to a private corporate GitLab. The shared Docker runner has
no Docker-in-Docker, and production builds, PDF export, and browser acceptance
need a live stack that the runner cannot host.

## Decision

`gitlab` is the only remote. `.gitlab-ci.yml` carries quality, coverage, API
integration, migrate-reset, and dependency-audit lanes with in-job loopback
PostgreSQL and Redis/Mailpit. Image builds, production build, PDF export, and
browser acceptance run locally per `docs/exemplary-code-standard.md#verification`.
A green pipeline is not full acceptance.

## Alternatives

- Docker-in-Docker runner for image builds and operational checks: rejected,
  needs privileged runners the host does not provide.
- Keep a second public remote: rejected, one source of truth for the MVP.

## Consequences

Local acceptance stays mandatory before "done". The pipeline stays fast and
needs no privileged runner. See `docs/gitlab-ci.md` for the lane list.
