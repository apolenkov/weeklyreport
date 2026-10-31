# Proposal

## Why

When a backup pass is killed by SIGKILL or lost to a crash or power loss, its
`weeklyreport-*.partial.*` file is never removed by the handler, which only runs
on SIGTERM and SIGINT. Such files accumulate in `BACKUP_DIR` indefinitely,
because retention prunes only `weeklyreport-*.dump` and the partial pattern is
never matched. TASK-503 C0059 tracks this gap (Backlog TASK-503.115). The
decision to sweep abandoned partials at start, under the writer lock, was made by
the coordinator under Root on 31.10 (option P-A′); the writer lock is already in
`main`.

## What Changes

- `backup-loop.sh` removes every `weeklyreport-*.partial*` file in `BACKUP_DIR`
  immediately after it acquires the writer lock and before the first dump of the
  process. The lock excludes any live writer, so an existing partial is abandoned.
- The sweep logs one line with the number of files it removed.
- Completed `weeklyreport-*.dump` files, their atomic publication and their
  retention pruning keep their current behavior.
- Backup runs that cannot acquire the lock, and so cannot prove that no writer is
  active, leave every file in place.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operations-local-readiness`: backup start clears abandoned partial files from
  earlier interrupted passes, under the writer lock.

## Impact

`deploy/postgres/backup-loop.sh`, `scripts/gates/operations/backup-loop-partial-sweep.test.ts` (new), `scripts/gates/operations/backup-loop.fixtures.ts` (new; shared stubs and runners, moved out of `backup-loop.test.ts`),
`docs/operations.md` (one sentence), and the task card TASK-503.115 (C0059). No
chart values, image, schedule, retention, lock or healthcheck behavior change.

## Non-goals

- Delete a partial by age or from a directory the lock does not cover.
- Change retention of completed dumps.
- Add a sweep to the staleness healthcheck or change its behavior.
