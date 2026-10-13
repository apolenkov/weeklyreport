# Proposal

## Why

A successful retry can lose its waiting job when an older Remove or reminder
recovery request resumes with a stale terminal-state read. C0757
(TASK-503.28) and C1358 (existing TASK-503.54) identify this gap; the prepared
native scenarios now have genuine coordinator-observed RED2 receipts.

## What Changes

- Make failed-job removal and reminder terminal replacement arbitrate current
  state and the caller-observed job identity atomically in Redis.
- Use one destructive adapter around the installed BullMQ compiled removal
  script, retaining native cleanup, locks and scheduler protections.
- Distinguish removed, missing, changed-state and changed-identity outcomes;
  report removal only when this operation removed the observed job.
- Keep add-only producers narrow and fail loudly when the inspected BullMQ
  version or script signature changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `queue-reliability-monitoring`: failed-job actions preserve concurrently
  retried or replaced jobs and return truthful outcomes; dependency-coupled
  terminal removal fails closed.
- `reliable-reminder-delivery`: recovery replaces only the same terminal job
  observed by its caller, preserving a retried waiting attempt under the same id.

## Impact

Consumers are `JobsService.removeFailed`, its stale-reminder cleanup and
generation-scoped PDF cleanup, plus `RemindersBullmqEnqueuer.enqueue` through
`reEnqueueStuck`. The boundary belongs to infrastructure/bullmq and is composed
through `createBootstrapJobsService` and `RemindersModule`. The add-only
`JobEnqueuer` contract must not acquire destructive capabilities.

Read the [approved adapter design](/Users/wrk/work/handoffs/task-503/api-confirmed-fixes/packet1/queue-red/design/ADAPTER.md),
[failed-job contract](../../specs/queue-reliability-monitoring/spec.md#requirement-head-queue-investigation-covers-every-monitored-queue),
and [reaper contract](../../specs/reliable-reminder-delivery/spec.md#requirement-a-reaper-re-enqueues-stuck-queued-executions).

## Non-goals

- Author source preparation is permitted on frozen TASK-513
  `76416bce000cf2f791f069bca76c9ffd3438b0fc`; approved product source follows the
  genuine native RED2. Final acceptance requires rebase
  onto the actually published TASK-513 main and checks on that resulting tree.
- No dependency downgrade to the preparation tree's BullMQ version, new
  dependency, custom Redis cleanup, process mutex or repeated-read workaround.
- No SMTP, browser, UI, authorization, durable reminder lifecycle, PDF generation
  arbitration, retention or database-schema change.
- Generic JobEnqueuer and search remain unchanged; reminders requires a separate
  destructive capability. Coordinator owns Backlog/Registry, native windows,
  delivery and tracking; written source does not imply GREEN or acceptance.
