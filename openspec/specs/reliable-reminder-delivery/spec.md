# reliable-reminder-delivery Specification

## Purpose

Guarantee that scheduled email reminders are delivered exactly once even under retries, concurrent workers, enqueue failures, and pod crashes.

## Requirements

### Requirement: Reminder send is idempotent under retry

The email-reminder processor MUST perform an atomic compare-and-set on the
execution's status before dispatching any email, so a BullMQ retry, a duplicate
concurrent worker, or an admin manual `job.retry()` never delivers the same
reminder twice. The processor MUST attempt to transition the execution from
`queued` to `sending` and, when that transition does not succeed because the row
is not `queued` (already `sending`, `sent`, or `failed`), MUST short-circuit and
acknowledge the job without sending. Only the caller that wins the transition
MUST dispatch the email. On a successful send the execution MUST be written
`sent`; on a send error it MUST be written `failed` with the error message, so a
failed send is a recorded terminal state and never a stuck `sending` row.

#### Scenario: Retry after a post-send write failure sends nothing

- **GIVEN** a reminder execution that a prior job attempt already transitioned
  to `sending` (or `sent`)
- **WHEN** BullMQ retries the job after the earlier attempt's post-send write
  threw
- **THEN** the compare-and-set from `queued` fails because the row is no longer
  `queued`
- **AND** the processor short-circuits and sends no second email

#### Scenario: The winning worker sends exactly once

- **GIVEN** two workers pick up jobs for the same `queued` execution
- **WHEN** both attempt the `queued → sending` transition
- **THEN** exactly one wins and dispatches the email
- **AND** the loser short-circuits without sending

#### Scenario: An admin manual retry does not re-send a completed reminder

- **GIVEN** an execution already marked `sent`
- **WHEN** an admin invokes the manual `job.retry()` action for its job
- **THEN** the re-run's compare-and-set from `queued` fails
- **AND** no duplicate email is dispatched

#### Scenario: A send error records a terminal failure

- **WHEN** the SMTP dispatch throws for an execution the worker moved to
  `sending`
- **THEN** the execution is written `failed` with the error message
- **AND** it is not left in `sending`

### Requirement: `sending` is a first-class reminder-execution status

The reminder-execution status vocabulary MUST include a `sending` state
representing an in-flight send that has claimed the row but not yet completed.
The state MUST exist end-to-end: in the Prisma `ReminderExecutionStatus` enum, in
the shared `adminReminderExecutionStatusSchema`, and in both directions of the
domain/persistence status mapping, so the compare-and-set claim is durable and
observable rather than in-memory only.

#### Scenario: The in-flight state round-trips through persistence

- **WHEN** an execution is transitioned to `sending` and later re-read
- **THEN** the persisted row carries the `sending` state
- **AND** the domain value read back is `sending`

#### Scenario: Every status consumer accepts `sending`

- **WHEN** a reminder execution in the `sending` state is parsed by the shared
  schema or rendered in the admin executions listing
- **THEN** it is accepted as a valid status rather than rejected or mislabeled

### Requirement: An enqueue failure is recorded, not swallowed

Requesting a reminder execution MUST NOT leave a committed `queued` row with no
job when the enqueue fails synchronously. The enqueue call MUST be guarded, and a
synchronous enqueue throw MUST mark the just-inserted execution `failed` with an
error message — a loud terminal state — rather than leaving an invisible `queued`
row. A single recipient's failure MUST NOT abort the remaining recipients of the
same scheduler tick: each recipient in the deadline and escalation fan-out MUST
be isolated so the loop continues past a failure.

#### Scenario: A synchronous enqueue throw marks the execution failed

- **GIVEN** a reminder execution row committed as `queued`
- **WHEN** the immediately following enqueue call throws (for example, the queue
  backend is unavailable)
- **THEN** the execution is marked `failed` with the enqueue error message
- **AND** it is not left in `queued` with no corresponding job

#### Scenario: One recipient's failure does not abort the tick

- **GIVEN** a scheduler tick fanning out reminders to several recipients
- **WHEN** the request for one recipient throws
- **THEN** the failure is logged and that recipient is skipped
- **AND** the remaining recipients of the same tick are still processed

### Requirement: A reaper re-enqueues stuck queued executions

A scheduled sweep MUST periodically re-enqueue reminder executions that are still
`queued` past a configured timeout — the pod-died-before-enqueue case, which
leaves no job and no `failed` marker and which the pinned dedupe key never
self-heals. The reaper MUST reclaim only `queued` executions; it MUST NOT
re-enqueue `sending` rows, because re-sending an in-flight row risks a duplicate.
A re-enqueued job MUST be safe against the original: the compare-and-set send
guard ensures whichever worker wins the `queued → sending` transition sends and
the other short-circuits, and the re-enqueue MUST carry a deterministic job id so
the queue backend also dedups it.

#### Scenario: A burned queued execution self-heals

- **GIVEN** a `queued` execution whose enqueue never happened because the pod
  died before it, leaving no job
- **WHEN** the reaper runs after the timeout
- **THEN** it re-enqueues a job for that execution
- **AND** the execution is delivered exactly once via the compare-and-set guard

#### Scenario: The reaper leaves in-flight rows untouched

- **GIVEN** an execution in the `sending` state
- **WHEN** the reaper runs
- **THEN** it does not re-enqueue that execution

#### Scenario: A re-enqueued job does not double-send with the original

- **GIVEN** a re-enqueued job and a late-arriving original job for the same
  execution
- **WHEN** both are processed
- **THEN** only one wins the `queued → sending` transition and sends
- **AND** the other short-circuits without sending

### Requirement: One dedupe-key shape across manual and automated dispatch

Every caller of `requestReminderExecution` for the `deadline` reminder kind MUST derive its dedupe key from the same builder, keyed by `{ ruleId, cycleDate, recipientEmail }` where `cycleDate` is the UTC `YYYY-MM-DD` truncation of the rule's `fireAt`.

This applies equally to the scheduler's automated tick (`RemindersScheduler.dispatchRule`) and the head-triggered manual dispatch (`RemindersScopeService.dispatchDraftSections`, reached via `reminders.dispatchPending`). Neither caller may build its own independent key shape for the same rule/recipient/cycle.

#### Scenario: Manual Remind after the automated reminder already fired

- **GIVEN** a reminder rule has already dispatched its automated deadline
  reminder to a lead for today's cycle
- **WHEN** a head triggers a manual `Remind` (`dispatchPendingReminders`)
  for that same rule and lead within the same cycle
- **THEN** no new `ReminderExecution` row is inserted and no second email is
  sent
- **AND** the response's `alreadySent` count includes that lead, not
  `dispatched`

#### Scenario: Manual Remind before any automated reminder has fired

- **GIVEN** a reminder rule has not yet dispatched any reminder to a lead
  for the current cycle
- **WHEN** a head triggers a manual `Remind` for that rule and lead
- **THEN** exactly one `ReminderExecution` row is inserted and one email is
  sent
- **AND** a subsequent automated scheduler tick for the same rule/lead/cycle
  deduplicates against it instead of sending a second email

#### Scenario: The dedupe key is internally consistent within one dispatch

- **GIVEN** `RemindersScopeService.dispatchDraftSections` processes a draft
  section during a manual dispatch
- **WHEN** it computes its own local key for the race-safe read-back and
  calls `requestReminderExecution` for the same rule/recipient
- **THEN** the locally computed key and the key `requestReminderExecution`
  builds internally are byte-identical

### Requirement: `dispatchPending` gates on the DB-resolved current editable report

The `dispatchPending` procedure MUST resolve the current editable report id
from the database (`weeklyReportService.getCurrentEditableId()`) and compare
the caller-supplied report id against that value. It MUST NOT rely on
`ctx.session.activeReportId`, a value computed once at login and baked into
the JWT, because a period rollover between login and the request leaves that
value stale.

#### Scenario: A legitimate Remind succeeds after a period rollover

- **GIVEN** a head logged in before a period rollover, whose JWT still carries
  the previous period's report id as `activeReportId`
- **WHEN** the head calls `dispatchPending` for the new, now-current editable
  report
- **THEN** the gate compares against the DB-resolved current editable report,
  not the stale session claim
- **AND** the call succeeds

#### Scenario: A request for a non-current report is still rejected

- **GIVEN** a report id that is not the current editable report
- **WHEN** `dispatchPending` is called with that report id
- **THEN** the procedure throws `FORBIDDEN "report-not-active"`

### Requirement: Reminder email payloads never surface a raw report id as a period label

The legacy (no-`kind`) reminder queue payload's `reportPeriod` field MUST
carry a human-readable period label derived from the rule's period bounds. It
MUST NOT carry the raw report UUID.

#### Scenario: A manually-triggered legacy reminder email shows a period label

- **GIVEN** a reminder rule dispatched through the legacy (no-`kind`) payload
  branch
- **WHEN** the queue payload is built
- **THEN** `reportPeriod` is a formatted period label
- **AND** it is not the rule's raw `reportId`

### Requirement: Admin execution-history pagination does not truncate past a fixed row count

`listExecutions` MUST page reminder executions at the database level. A
rule's execution history MUST remain fully walkable via cursor pagination
regardless of how many executions have accumulated; pagination MUST NOT
silently stop because an in-memory slice ran out of rows.

#### Scenario: Execution history beyond 100 rows is still reachable

- **GIVEN** a reminder rule with more than 100 recorded executions
- **WHEN** an admin pages through `listExecutions` using the returned cursor
  repeatedly
- **THEN** every execution row is eventually returned
- **AND** `nextCursor` becomes `null` only after the true last row, not after
  a fixed 100-row slice
