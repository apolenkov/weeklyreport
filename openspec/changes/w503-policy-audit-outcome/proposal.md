# Proposal

## Why

Concurrent saves can log two reminder creations even though the second request updated the first request's row. TASK-503.19 (C0456/C0786) requires the dedicated audit action to describe the committed write, including deletion races.

## What Changes

- Obtain the internal creation outcome inside the existing policy/rule transaction and carry it through the repository and service to the audit emitter.
- Remove the separate existence read; retain the public policy response.
- Retry a vanished conflicting row finitely, then fail with a typed conflict without a success audit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `audit-target-coverage`: reminder save audits reflect the committed create/update outcome.

## Impact

The admin reminder policy query, repository port/implementation, service and tRPC procedure change together. Existing contracts in [reliable-reminder-delivery](../../specs/reliable-reminder-delivery/spec.md), [admin-reminders-ui](../../specs/admin-reminders-ui/spec.md) and [admin-entity-write-integrity](../../specs/admin-entity-write-integrity/spec.md) remain applicable. Real PostgreSQL regression tests call the public procedure. No dependency or schema change is needed.

## Non-goals

- Queue production repair and unrelated TASK-503 findings.
- Changing public policy fields or reminder scheduling semantics.
- Database isolation changes, PostgreSQL-version-specific MVCC metadata, or audit storage redesign.
