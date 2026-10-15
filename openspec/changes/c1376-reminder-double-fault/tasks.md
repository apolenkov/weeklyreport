# Tasks

## 1. Double-fault characterization

- [x] 1.1 Add the DB-backed test in `reminders.integration.test.ts`: real `RemindersScheduler`, service, repository and `RemindersReaperScheduler`; the queue port rejects once; a PostgreSQL trigger rejects the compensating `failed` write; assert the logged enqueue cause, the rejected caller, fan-out, the durable `queued` row, the reaper re-enqueue and a single claim.
- [x] 1.2 Run the test with the full reminders integration file on the base under a granted guarded-lane window; every assertion is expected to pass. A failing invariant is saved as RED and escalated before any product change. (lane b, c31ef4875, step1 1/1, file 29/29)

## 2. Verification and delivery

- [ ] 2.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the reviewed tree; independent review.
