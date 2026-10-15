## Why

The tester values schedule the backup CronJob hourly against `weeklyreport_e2e`
(`deploy/tester-kit/values-tester.yaml:72-73`, `deploy/helm/weeklyreport/templates/backup.yaml:56-62`).
`deploy/tester-kit/reset.sh` stops only the API before `migrate-reset` and the reseed, so a
scheduled or manual backup can dump the database while it is being dropped and reseeded, or hold
locks that stall the reset. The production restore runbook already suspends backups and waits for
active backup Jobs (`docs/operations.md:270-282`); the tester reset does not (TASK-503.16.01,
finding C0105/F136-3).

## What Changes

- `reset.sh` records the backup CronJob's suspension state, suspends it, and waits for every
  running backup pod to finish before stopping the API and running `migrate-reset`.
- A backup that does not finish in the bounded wait, or an unreadable suspension state, refuses
  the reset before any database change.
- Exit, failure and interrupt restore the recorded suspension state; an already suspended
  CronJob stays suspended.

The backup writer lock (`backup-writer-lock`) is unchanged: it serializes writers on backup
storage, while this change keeps backup readers off a database being reset.

## Impact

- `deploy/tester-kit/reset.sh`, `scripts/gates/operations/tester-kit-reset.test.ts`.
- Tester stand only; production chart and backup script unchanged.
