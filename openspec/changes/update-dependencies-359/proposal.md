# Proposal

## Why

WeeklyReport needs current supported dependencies without disrupting report editing,
publishing, authentication, or exports. TASK-359 and the registry inventory taken on
2026-10-07 identify stale workspace manifests, catalog entries, overrides, tools,
and container images.

## What Changes

- Update compatible patch/minor versions together.
- Verify breaking dependency groups separately and commit each group separately.
- Keep a lower version only when a concrete check fails; explain the failure in
  its commit and encode the restriction in Renovate.
- Verify the complete application against the reserved disposable database.

## Capabilities

No specification-level behavior changes; `skip_specs: true` applies. Existing
dependency-integrity, dependency-vulnerability-scanning, and test-evidence-integrity
contracts remain authoritative.

## Impact

Workspace manifests, lockfile, build/runtime declarations, container references,
Renovate configuration, and public SDK imports affected by migration.

## Non-goals

- Product redesign or business-rule changes.
- Third-party package patches or reduced quality/coverage thresholds.
- Merge, deployment, or publication beyond the requested GitLab MR.
