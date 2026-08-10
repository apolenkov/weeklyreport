## Context

See `proposal.md` for motivation. Current workflows already use full-SHA action
pins, digest-pinned service images, frozen installs, and distinct quality, E2E,
migration-reset, Docker-build, and dependency-audit jobs. They omit explicit
token permissions and checkout credential isolation. Live evidence confirms
that `main` is unprotected; other administrative security settings are
unverified because the current API token or private-repository plan returns
`403`.

This change touches only repository policy, workflow configuration,
documentation, and deterministic gates. It preserves the period dual-state,
role-coverage, destructive-database, and deferred-feature invariants because no
application or database write path changes.

## Goals / Non-Goals

**Goals:**

- Make every current workflow read-only by construction.
- Detect future permission and checkout-credential regressions locally and in
  CI.
- Give maintainers one durable, stage-by-stage readiness contract.
- Make ownership and private incident reporting discoverable.

**Non-Goals:**

- Mutate GitHub settings with an insufficiently scoped token.
- Add a release or deployment workflow before its real external boundaries
  exist.
- Enable plan-dependent security jobs that would make CI fail by construction.

## Decisions

### Set workflow-level read-only permissions

Each current workflow receives `permissions: contents: read`. Job-level write
permissions are unnecessary because no current job publishes code, packages,
security results, attestations, or deployments. This is preferred to relying on
repository defaults, which are external and currently unreadable.

### Disable checkout credential persistence everywhere current

All current checkouts are read-only, so every checkout sets
`persist-credentials: false`. A future write-back job must opt in at the narrow
job boundary instead of inheriting credentials in arbitrary test steps.

### Extend the existing configuration gate

The current `lint:config-hygiene:test` suite will parse workflows with the
direct `yaml` development dependency, reject invalid, duplicate-key, warning,
and alias-bearing documents, and inspect the resulting jobs and steps. This
makes the controls part of the existing 38-check lint gate without maintaining
a partial YAML grammar. Fixtures prove both the accepted and rejected shapes.

The Knip workspace disables only Prisma configuration-file loading while
retaining Prisma schema discovery. Static analysis therefore cannot emit an
environment-resolution error and still exit successfully when `DATABASE_URL`
is absent. Configuration hints are fatal, and a configuration-hygiene probe
pins that fail-closed boundary.

### Document production controls without simulating production

`docs/sdlc.md` records lifecycle evidence and the first-production checklist.
It links to durable specs and operational guidance. Registry publication,
attestation, deployment environments, off-site backups, and notification paths
remain blocked until their real identities and owners exist.

### Use the repository owner as the initial code owner

The private repository currently has one verified administrator identity,
`@apolenkov`. Sensitive patterns name that owner explicitly. Team-based owners
can replace it when GitHub teams and delegated ownership exist.

## Risks / Trade-offs

- **Repository ownership is initially single-person** -> Keep the policy
  explicit and replace it with teams before production support becomes shared.
- **YAML composition can obscure the effective token boundary** -> Reject
  aliases and ambiguous documents, and validate the resolved permissions and
  checkout inputs rather than line shapes.
- **Documented production gates are not active controls** -> Mark each as
  blocked or unverified and require external evidence before status changes.
- **A future job may legitimately need a write token** -> Require job-local
  scope and a matching gate allowlist update with review.
- **Tool plugins can hide configuration-load failures behind exit zero** ->
  Disable environment-dependent plugin config loading when the static analysis
  does not need it, and pin the exact override with a planted gate probe.

## Migration Plan

1. Add policy files, SDLC documentation, workflow permissions, and checkout
   isolation.
2. Add negative and positive configuration-gate tests.
3. Run targeted tests, strict OpenSpec validation, full lint/typecheck/test/
   build, and the source-bound runtime campaign.
4. Roll back by reverting the repository-only commit; no database, deployment,
   secret, or external GitHub setting is changed.
