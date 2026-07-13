## Why

Wave 1 / P1 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

Reminder delivery is non-transactional at the send/write boundary, in two
independent ways confirmed against the code:

- **Duplicate on retry.** `EmailReminderProcessor.processJob`
  (`apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`) sends the
  email and only afterwards calls `markReminderSent`. There is no status read
  before the send. If the post-send write throws, BullMQ's `attempts: 3`
  retry (`reminders.service.ts`) re-runs the job and the recipient is emailed
  again. The admin manual "retry job" action (`jobs.service.ts` → `job.retry()`)
  amplifies the same window.
- **Silently burned execution.** `requestReminderExecution`
  (`apps/api/src/modules/reminders/reminders.service.ts`) commits the
  `ReminderExecution` row as `queued` (Prisma `pending`) _before_
  `emailQueue.add()`, and the enqueue call has no `try/catch`. If the enqueue
  throws or the pod dies between commit and enqueue, the row and its unique
  `dedupeKey` are consumed for the cycle, no job exists, and nothing re-enqueues
  it. The dedupe key is pinned to `rule.fireAt`'s date, so it never advances
  within the rule — the burned row never self-heals; only a future report
  period's fresh rule produces a new key. A single enqueue throw additionally
  aborts the remaining recipients of that scheduler tick, because the fan-out
  loop in `reminders.scheduler.ts` has no per-recipient `try/catch`.

Blast radius: internal deadline and escalation-digest emails are duplicated or
missed. Each incident lands on a real recipient; the miss does not recover
inside the rule.

## What Changes

- **Idempotent send via compare-and-set.** Add a `sending` state to the
  reminder-execution status vocabulary. Before any SMTP dispatch,
  `processJob` performs an atomic `queued → sending` transition and
  short-circuits (acks the job without sending) when the row is not `queued` —
  so a retry, a duplicate concurrent worker, or an admin `job.retry()` that
  finds the row already `sending`/`sent`/`failed` sends nothing. On success it
  writes `sent`; on a send error it writes `failed`. `emailQueue.add` also sets
  `jobId: execution.id` so BullMQ itself dedups a re-enqueued job on top of the
  database compare-and-set.
- **Enqueue failure is recorded, not swallowed.** Wrap `emailQueue.add` in
  `requestReminderExecution` in `try/catch`; a synchronous enqueue throw marks
  the just-inserted execution `failed` with an `errorMessage` (Redis-down and
  the like — a loud, visible terminal state, not an invisible `queued` row).
  Wrap each recipient in the scheduler fan-out loops (`dispatchRule`,
  `dispatchEscalation`) so one recipient's failure never aborts the rest of the
  tick.
- **Reaper for stuck `queued` executions.** Add a scheduled sweep that finds
  executions still `queued` past a timeout (the pod-died-before-enqueue case,
  which leaves no job and no `failed` marker) and re-enqueues them. Combined
  with the compare-and-set guard, a re-enqueued job is safe: whichever worker
  wins the `queued → sending` transition sends, the other short-circuits.
- **Status vocabulary sweep.** `sending` is added to
  `ReminderExecutionStatus` (Prisma enum, via the hand-edited init migration +
  `migrate reset`), to `adminReminderExecutionStatusSchema`
  (`packages/shared/src/schemas/report.schema.ts`), and to both direction maps
  in `reminders-row-mappers.ts`.

The enqueue-failure=`failed` path and the reaper are non-overlapping by design:
a synchronous `add()` throw is a live, recorded terminal failure; a pod death
before `add()` leaves a `queued` row that only the reaper can heal. A `failed`
enqueue-error row is intentionally not re-sent this cycle — the burned
`dedupeKey` (`inserted: false` on the next tick) means it is recorded and
alerted on, not silently retried.

## Capabilities

### New Capabilities

- `reliable-reminder-delivery`: reminder send is idempotent under retry, an
  enqueue failure is recorded rather than swallowed, and stuck `queued`
  executions self-heal via a reaper.

### Modified Capabilities

(none)

## Impact

- `prisma/schema.prisma` (add `sending` to `ReminderExecutionStatus`);
  `prisma/migrations/20260530162224_init/migration.sql` (hand-edit the enum);
  reseed via `migrate reset`
- `packages/shared/src/schemas/report.schema.ts`
  (`adminReminderExecutionStatusSchema`)
- `apps/api/src/modules/reminders/reminders-row-mappers.ts`
  (`execStatusToDb` / `dbExecStatusToDomain`)
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`
  (compare-and-set + short-circuit + success/error status writes)
- `apps/api/src/modules/reminders/reminders.service.ts`
  (enqueue `try/catch`, `jobId`, compare-and-set method, mark-failed method,
  stuck-queued lister)
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts` and its
  `RemindersRepository` port (compare-and-set, mark-failed, list-stuck-queued)
- `apps/api/src/modules/reminders/reminders.scheduler.ts` (per-recipient
  isolation) + a new reaper scheduler wired in `reminders.module.ts`

Non-goals:

- **The `sending`-stall residual is accepted, not eliminated.** A worker killed
  mid-SMTP (after the `queued → sending` transition, before the status write)
  leaves a `sending` row. The reaper deliberately reclaims only `queued` rows,
  so a `sending`-stall is not auto-re-enqueued — re-sending it would risk a
  duplicate for the truly-sent case. The window is the sub-send interval
  between the transition and the status write; a stuck `sending` row is
  observable (it never reaches `sent`/`failed`) and surfaced through existing
  queue/DLQ monitoring rather than healed automatically.
- The `dedupeKey` shape is left unchanged — the reaper, not a key redesign, is
  the sanctioned recovery for a burned `queued` row.
- No new admin UI for the `sending` state beyond the existing status listing
  rendering the new label.
- `redact-pii-logs` touches the same reminder files and must land **after**
  this change; it is out of scope here.
