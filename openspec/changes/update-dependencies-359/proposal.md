# Proposal

## Why

WeeklyReport needs current supported dependencies without disrupting report editing,
publishing, authentication, or exports. TASK-359 and the registry inventory taken on
2026-10-09 identify stale workspace manifests, catalog entries, overrides, tools,
and container images.

## What Changes

- Update compatible patch/minor versions together.
- Verify breaking dependency groups separately and commit each group separately.
- Keep a lower version only when a concrete check fails; explain the failure in
  its commit and encode the restriction in Renovate.
- Verify the complete application against the reserved disposable database.
- Repair the owner-requested NavBrand label-in-name defect exposed by axe-core
  4.14.0 and keep its accessibility check enabled.
- Use stable React Hooks compiler diagnostics and native Radix dialog IDs while
  preserving the existing lint and accessible-confirmation contracts.

## Capabilities

The requested navigation fix updates `user-name-display`. Existing
dependency-integrity, dependency-vulnerability-scanning, test-evidence-integrity,
error-trace-correlation, and dialog-listbox-a11y contracts remain authoritative.

## Impact

Workspace manifests, lockfile, build/runtime declarations, container references,
Renovate configuration, and public SDK imports affected by migration.
The navigation home link gains a native accessible name containing its initials.

## Non-goals

- Product redesign or business-rule changes.
- Third-party package patches or reduced quality/coverage thresholds.
- Server deployment or publication beyond the authorized GitLab main delivery.
