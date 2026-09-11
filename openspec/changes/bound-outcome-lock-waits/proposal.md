# Bound outcome lock waits

## Why

The PostgreSQL adapter queues Prisma's timed-out rollback behind an in-flight
row-lock query. Resolve and Restore can therefore remain pending beyond their
existing 15-second transaction timeout.

## What Changes

- Set a transaction-local PostgreSQL lock timeout before outcome locks.
- Verify blocked requests reject, preserve stored state, and succeed on retry
  after the blocker is released.

## Impact

- Affected spec: `unified-report-authoring`.
- Affected code: the shared Resolve/Restore target loader and its tests.
- No schema or environment configuration changes.
