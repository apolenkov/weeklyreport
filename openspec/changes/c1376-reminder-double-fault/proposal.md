# Proposal

## Why

When the email queue rejects a just-recorded reminder execution and the
database also rejects the compensating `failed` write, the current requirement
still promises that the row is never left `queued` without a job. That promise
cannot hold while the database rejects the write. The source already behaves
safely: the enqueue error is logged, the caller receives the compensation
rejection instead of a fabricated `failed` execution, the scheduler counts the
recipient as failed and continues, and the stuck-queued reaper later recovers
the durable `queued` row. No scenario states or tests this path (TASK-503
C1376; Backlog TASK-503.06).

## What Changes

- The enqueue-failure requirement names the double fault and its existing
  recovery owner: a rejected compensation leaves the row durable `queued`, the
  request rejects with that compensation error after logging the enqueue error,
  and no `failed` result is returned unless it was persisted.
- A DB-backed characterization test drives the real `RemindersScheduler`,
  service, repository and `RemindersReaperScheduler` through the double fault
  and recovery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reliable-reminder-delivery`: an enqueue failure whose compensation also fails.

## Impact

`apps/api/src/modules/reminders/reminders.integration.test.ts` only. No
production code, schema, migration, queue option, retry, timeout or error
mapping changes.

## Non-goals

- Returning a best-effort `failed` execution when the compensation was not
  persisted (the original finding's remedy). It would contradict the durable
  `queued` row that the reaper later sends.
- A new error type combining both causes; that contract is not accepted.
- Retrying the compensation write or the enqueue inline, or changing the reaper
  timeout or batch size.
- Editing the helper comment in `reminders-enqueue.ts` ("never linger"); that is
  a production file outside this change and is left to a separate decision.
