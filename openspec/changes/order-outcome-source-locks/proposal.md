# Order outcome source locks before writes

## Why

A real PostgreSQL race reproduced a deadlock between resolving a submitted prior
plan and revoking its submission. Resolve increments the target section first,
which locks the semantic generation row, then waits for the source report.
Revocation holds the source report and needs the generation row.

## What Changes

- Resolve source identity and acquire its required locks before the outcome
  version write. Keep early stale-version rejection and atomic compare-and-set.
- Preserve replay, Restore, timeout and rollback behavior.
- Verify both competing orders against PostgreSQL and existing outcome checks.

## Impact

- Affected spec: `unified-report-authoring`.
- Affected code: outcome target loading and outcome transactions.
