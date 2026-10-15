# Proposal

## Why

The scheduled backup CronJob, a manual Job created from it, and the standalone
loop all write to one backup directory. `concurrencyPolicy: Forbid` serializes
only the CronJob controller, so two writers can interleave dumps and retention
pruning, and no future cleanup of interrupted partial files can tell an orphan
from another writer's active dump (TASK-503 C0059, item 26; Backlog
TASK-503.16.01).

## What Changes

- `backup-loop.sh` takes an exclusive, non-blocking lock on
  `$BACKUP_DIR/.backup-writer.lock` with the image's BusyBox `flock` for the
  whole process, before reserving a file, dumping or pruning.
- A second writer exits with status 75 and a writer-lock message instead of
  waiting. The kernel releases the lock when the holder and the `pg_dump` it
  started have exited, so a killed run leaves no stale state. The lock file is never removed.
- The operations runbook describes the lock, its exit status, and the writers
  it cannot bind.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deploy-kubernetes-chart`: one backup writer per backup directory.

## Impact

`deploy/postgres/backup-loop.sh`, `scripts/gates/operations/backup-loop.test.ts`,
and the Backups section of `docs/operations.md`. No chart values, schedule,
retention, deadline or base image change. Native mutual-exclusion and crash-release
checks on the exact image run separately under a granted window.

## Non-goals

- Sweep interrupted `.partial` files (C0059 stays open and on hold).
- Lock restore or inspect Jobs, which mount the volume read-only.
- Add a wait timeout, retry or new configuration.
