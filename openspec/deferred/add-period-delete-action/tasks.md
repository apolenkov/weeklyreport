# Tasks

- **PERIOD-T1** — Create tRPC procedure `periods.delete(<periodId>)` with
  head-role-coverage middleware and destructive-guard check.

- **PERIOD-T2** — Implement cascade delete in the Prisma repository (reports
  and sections associated with the period).

- **PERIOD-T3** — Add delete confirmation dialog component in the period
  management UI (likely in head admin dashboard).

- **PERIOD-T4** — Test: attempt delete of an in-progress period (expect
  warning), confirm cascading delete works, verify deleted period no longer
  appears in lists.

## Activation trigger

**Trigger:** Head/admin explicitly requests period deletion capability OR
when manual period cleanup becomes a recurring operational task.
