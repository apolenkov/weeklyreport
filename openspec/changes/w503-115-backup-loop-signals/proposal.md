# Proposal

## Why

`deploy/postgres/backup-loop.sh` is the container command of the backup
CronJob (`deploy/helm/weeklyreport/templates/backup.yaml`), so it runs as PID 1.
The kernel gives PID 1 no default action for SIGTERM, and the script installs no
handler. Kubelet's termination signal is therefore ignored, the pod waits out
its grace period, and SIGKILL can stop a `pg_dump` mid-write and leave a
`.partial` file behind (TASK-503 C0064; Backlog TASK-503.115).

## What Changes

- `backup-loop.sh` traps TERM and INT. The handler stops the running child
  (`pg_dump` or the loop's `sleep`), removes the partial file of the current
  pass with the same `rm -f` the script already uses on failure, and exits with
  143 (TERM) or 130 (INT).
- Foreground children run in the background and are awaited, so a trapped
  signal is handled at once instead of after the dump finishes.
- Publication of a completed dump (atomic `mv -n`, then retention) keeps its
  current order and its failure handling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operations-local-readiness`: backup automation stops promptly on termination
  signals and leaves no partial file from the interrupted pass.

## Impact

`deploy/postgres/backup-loop.sh`, `scripts/gates/operations/backup-loop.test.ts`,
and the task card TASK-503.115. No chart values, image, schedule, retention or
lock behavior change. The `.backup-writer.lock` release still relies on the
descriptor closing; the handler waits for the child before exiting, so the lock
is released only after `pg_dump` has exited.

## Non-goals

- Sweep partial files left by SIGKILL or a power loss (C0059 stays open).
- Add a grace-period setting, a retry or a wait timeout.
- Change `docs/operations.md` or the Helm chart.
