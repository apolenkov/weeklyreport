## 1. Status vocabulary: add `sending`

- [ ] 1.1 `prisma/schema.prisma`: add `sending` to the
      `ReminderExecutionStatus` enum. Hand-edit
      `prisma/migrations/20260530162224_init/migration.sql` to include the new
      enum value, then re-apply with `prisma migrate reset` (pass
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) and reseed
- [ ] 1.2 `packages/shared/src/schemas/report.schema.ts`: add `"sending"` to
      `adminReminderExecutionStatusSchema`
- [ ] 1.3 `apps/api/src/modules/reminders/reminders-row-mappers.ts`: add
      `sending → sending` to `execStatusToDb` and `sending → sending` to
      `dbExecStatusToDomain`
- [ ] 1.4 Grep for any exhaustive status match or label map that now misses
      `sending`: `grep -rn "queued\|sending\|sent\|failed" apps/web/src apps/api/src packages/shared/src` — extend each non-test consumer that enumerates execution statuses

## 2. Idempotent send (compare-and-set)

- [ ] 2.1 `RemindersRepository` port + `reminders.prisma-repository.ts`: add a
      compare-and-set method that atomically moves a `queued` (Prisma
      `pending`) execution to `sending` and returns whether THIS call won the
      transition — a conditional `updateMany({ where: { id, status: pending }, data: { status: sending } })` whose count is 0 when the row was not `queued`
- [ ] 2.2 `email-reminder.processor.ts` `processJob`: before any
      `sendMailMultipart`/`sendMail` call, run the compare-and-set; if it did
      not win (row already `sending`/`sent`/`failed`), return early without
      sending
- [ ] 2.3 `processJob`: on successful send keep `markReminderSent` (writes
      `sent`); on a send error mark the execution `failed` with the error
      message before rethrowing, so a genuinely failed send is a recorded
      terminal state, not a stuck `sending`
- [ ] 2.4 `reminders.service.ts`: set a deterministic `jobId: execution.id` on
      the `emailQueue.add` options so BullMQ dedups a reaper re-enqueue on top
      of the compare-and-set

## 3. Enqueue failure is recorded, not swallowed

- [ ] 3.1 `RemindersRepository` port + `reminders.prisma-repository.ts`: add a
      mark-failed method that writes `status: failed` + `errorMessage`
- [ ] 3.2 `reminders.service.ts` `requestReminderExecution`: wrap
      `emailQueue.add` in `try/catch`; on throw, mark the just-inserted
      execution `failed` with the enqueue error message and do NOT rethrow past
      the recipient boundary
- [ ] 3.3 `reminders.scheduler.ts` `dispatchRule` and `dispatchEscalation`:
      wrap each `requestReminderExecution` call so one recipient's failure is
      logged and skipped, and the loop continues to the remaining recipients of
      the tick

## 4. Reaper for stuck `queued` executions

- [ ] 4.1 `RemindersRepository` port + `reminders.prisma-repository.ts`: add a
      lister that returns executions still `queued` (Prisma `pending`) whose
      `createdAt` is older than a configured timeout
- [ ] 4.2 Add a reaper scheduler (own file next to `reminders.scheduler.ts`,
      `@Cron`-driven, with a test-drivable `runOnce(now)`): for each stuck
      `queued` execution, re-enqueue an `email-reminder` job (reusing the
      service's enqueue path and `jobId: execution.id`)
- [ ] 4.3 `reminders.module.ts`: register the reaper scheduler provider
- [ ] 4.4 Confirm the reaper reclaims ONLY `queued` rows — `sending` rows are
      left untouched (documented accepted residual); assert this in a test

## 5. Spec + tests

- [ ] 5.1 Test: retrying a `processJob` whose execution is already `sending`
      (or `sent`) sends no second email (compare-and-set short-circuit)
- [ ] 5.2 Test: `requestReminderExecution` with an `emailQueue.add` that throws
      leaves the execution `failed` (not `queued`), and the scheduler tick
      continues to the next recipient
- [ ] 5.3 Test: the reaper re-enqueues a `queued` execution past the timeout
      and does NOT re-enqueue a `sending` one

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 `pnpm test:integration` (reminder dispatch integration suite, single-thread)
- [ ] 6.4 `npx openspec validate reliable-reminder-delivery --strict`
