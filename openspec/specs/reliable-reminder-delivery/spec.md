# reliable-reminder-delivery Specification

## Purpose

Prevent duplicate automatic reminder delivery under retries and concurrent
workers, while surfacing the irreducible SMTP-versus-database crash ambiguity
as an explicit terminal outcome. Exactly-once delivery is not claimed without
provider-side idempotency.

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
`sent`. When SMTP dispatch fails and BullMQ still has a configured retry, the
processor MUST release the claim from `sending` back to `queued` and rethrow so
the next attempt can win the normal compare-and-set. Only the final configured
attempt MUST write `failed` with the error message. A failure after SMTP
succeeds but before `sent` is persisted MUST remain `sending`; it MUST NOT be
released, because retrying an email that may already have been delivered risks
a duplicate.

#### Scenario: Retry after a post-send write failure sends nothing

- **GIVEN** a reminder execution that a prior job attempt already transitioned
  to `sending` (or `sent`)
- **WHEN** BullMQ retries the job after the earlier attempt's post-send write
  threw
- **THEN** the compare-and-set from `queued` fails because the row is no longer
  `queued`
- **AND** the processor short-circuits and sends no second email

#### Scenario: At most one competing worker sends

- **GIVEN** two workers pick up jobs for the same `queued` execution
- **WHEN** both attempt the `queued → sending` transition
- **THEN** exactly one wins and dispatches the email
- **AND** the loser short-circuits without sending

#### Scenario: An admin manual retry does not re-send a completed reminder

- **GIVEN** an execution already marked `sent`
- **WHEN** an admin invokes the manual `job.retry()` action for its job
- **THEN** the re-run's compare-and-set from `queued` fails
- **AND** no duplicate email is dispatched

#### Scenario: An intermediate send error releases the claim for retry

- **WHEN** the SMTP dispatch throws for an execution the worker moved to
  `sending`
- **AND** the BullMQ job has another configured attempt remaining
- **THEN** the execution is returned to `queued`
- **AND** the error is rethrown so the next attempt can claim it

#### Scenario: The final send error records a terminal failure

- **WHEN** SMTP dispatch throws on the final configured attempt
- **THEN** the execution is written `failed` with the error message
- **AND** it is not left in `sending` or returned to `queued`

### Requirement: Claimed reminder rendering uses durable execution data

The `queued → sending` compare-and-set MUST return the execution row's
persisted recipient and validated queue payload from the same transaction. The
processor MUST render and address the email only from that durable result; the
BullMQ body is an execution locator and trace carrier, not renderer authority.
Payload validation MUST occur inside the claim transaction so invalid durable
state rolls the status update back.

#### Scenario: An old failed BullMQ job is retried after manual revival

- **GIVEN** failed job A contains an older valid recipient and renderer payload
- **AND** explicit manual revival has persisted current payload B on the same
  execution and returned it to `queued`
- **WHEN** job A is retried from the admin jobs surface and wins the claim
- **THEN** the email is addressed and rendered exclusively from durable payload
  B
- **AND** no recipient or renderer field from stale job A is used

### Requirement: `sending` is a first-class reminder-execution status

The reminder-execution status vocabulary MUST include a `sending` state
representing an in-flight send that has claimed the row but not yet completed.
The state MUST exist end-to-end: in the Prisma `ReminderExecutionStatus` enum, in
the shared `adminReminderExecutionStatusSchema`, and in both directions of the
domain/persistence status mapping, so the compare-and-set claim is durable and
observable rather than in-memory only.
Every persisted and recovery-facing lifecycle tuple MUST be coherent:
`queued`/`sending` carry neither `sentAt` nor an error; `sent` carries a
non-null `sentAt` and no error; `failed` carries no `sentAt` and a non-empty
non-whitespace error. Shared validation and the canonical PostgreSQL schema
MUST enforce the same current-only rule. Every application path that
terminalizes an execution MUST normalize an empty or whitespace-only thrown
message to the deterministic non-empty fallback `Unknown error` before the
write.

#### Scenario: The in-flight state round-trips through persistence

- **WHEN** an execution is transitioned to `sending` and later re-read
- **THEN** the persisted row carries the `sending` state
- **AND** the domain value read back is `sending`

#### Scenario: Every status consumer accepts `sending`

- **WHEN** a reminder execution in the `sending` state is parsed by the shared
  schema or rendered in the admin executions listing
- **THEN** it is accepted as a valid status rather than rejected or mislabeled

#### Scenario: Lifecycle outcome fields contradict status

- **WHEN** a reminder execution is written or restored with outcome fields
  that contradict its status
- **THEN** shared validation rejects it
- **AND** the canonical database lifecycle check rejects a direct invalid write

#### Scenario: An adapter throws without a useful message

- **WHEN** synchronous enqueue or the final SMTP attempt throws an error whose
  message is empty or contains only whitespace
- **THEN** the execution reaches `failed` with `Unknown error`
- **AND** it is not stranded in `queued` or `sending` by lifecycle validation

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
the other short-circuits. The reaper MUST use the execution id as the recovery
job id and, before adding it, remove an existing job with that id only when its
BullMQ state is terminal (`failed` or `completed`). It MUST never remove or
replace an active, waiting, delayed, or otherwise non-terminal job. This makes
recovery self-healing when a malformed pre-claim job is retained as failed,
while preserving the at-most-once DB claim guarantee.

#### Scenario: A burned queued execution self-heals

- **GIVEN** a `queued` execution whose enqueue never happened because the pod
  died before it, leaving no job
- **WHEN** the reaper runs after the timeout
- **THEN** it re-enqueues a job for that execution
- **AND** at most one worker dispatches it via the compare-and-set guard

#### Scenario: The reaper never automatically resends an in-flight row

- **GIVEN** an execution in the `sending` state
- **WHEN** the reaper runs
- **THEN** it does not re-enqueue that execution
- **AND** after the conservative timeout it records a terminal unknown-delivery
  failure for manual review

#### Scenario: A re-enqueued job does not double-send with the original

- **GIVEN** a re-enqueued job and a late-arriving original job for the same
  execution
- **WHEN** both are processed
- **THEN** only one wins the `queued → sending` transition and sends
- **AND** the other short-circuits without sending

#### Scenario: A retained failed job does not block reaper recovery

- **GIVEN** a queued execution has a retained failed BullMQ job with the same
  execution id because an earlier attempt rejected its malformed payload before
  claiming the database row
- **WHEN** the reaper recovers the queued execution
- **THEN** it removes that job only after observing the terminal `failed` state
- **AND** it adds a fresh job with the same execution id and current durable
  payload
- **AND** subsequent processing can claim the row and reach a terminal database
  state
- **AND** an active or waiting job with that id is never removed

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

### Requirement: Every reminder queue payload is explicitly discriminated

Every email-reminder queue payload MUST include `contractVersion: 1`, a
supported `kind` discriminator, and the complete fields required by that kind's
renderer. No producer or worker may accept an unversioned payload or one without
its discriminator.

#### Scenario: Stuck queued execution is recovered with the current contract

- **GIVEN** a queued reminder execution whose original enqueue was interrupted
- **WHEN** the reaper re-enqueues that execution
- **THEN** the job reuses the exact validated payload persisted with the
  execution, including its discriminator, recipient, names, dates, brand,
  period label, late leads, and URL
- **AND** the worker renders the normal deadline template through the single
  current renderer

#### Scenario: Every execution always has a current payload

- **GIVEN** a new reminder execution in any lifecycle state
- **WHEN** it is persisted
- **THEN** it includes a complete current payload with `contractVersion: 1` and
  a supported `kind` discriminator
- **AND** the database rejects any execution whose payload is absent

### Requirement: Admin recovery retains at-most-once reminder state

Admin snapshot export and restore MUST round-trip every persisted reminder
execution, including its dedupe key, lifecycle status, exact validated queue
payload, send/error outcome, and persistence timestamps. Restore MUST insert or
update executions only after their referenced rules exist. It MUST NOT reset a
`sending` or `sent` execution to `queued`, because doing so could deliver an
already claimed reminder twice. The restored `updatedAt` MUST retain the age
used by stale-sending reconciliation.
An additive admin restore MUST merge this lifecycle monotonically: a stale
queued snapshot cannot overwrite a live `sending`, `sent`, or `failed` row.
Immutable execution identity and payload conflicts MUST fail closed rather than
being reconciled by overwriting live data. `updatedAt` is the first merge
barrier: an older snapshot never wins regardless of status, while equal
timestamps with different lifecycle data are a deterministic conflict. Even a
newer snapshot MUST NOT reset `sending`, `sent`, or `failed` to queued; recovery
rejects that transition instead of treating its timestamp as dispatch authority.

#### Scenario: recovery does not resend a completed reminder

- **GIVEN** a snapshot contains a `sent` execution
- **WHEN** the snapshot is restored and the same rule, cycle, and recipient are
  scheduled again
- **THEN** the persisted dedupe key resolves to the restored sent execution
- **AND** no new queue job is created

#### Scenario: recovery retains queued renderer input

- **GIVEN** a snapshot contains a `queued` execution
- **WHEN** the snapshot is restored
- **THEN** the execution stays queued with the exact `contractVersion: 1`
  payload and original lifecycle timestamps

#### Scenario: stale recovery does not reopen a terminal execution

- **GIVEN** a queued snapshot captured before the live execution advanced to a
  terminal outcome
- **WHEN** the admin recovery snapshot is applied
- **THEN** the terminal row and its dedupe key remain unchanged
- **AND** the execution cannot be enqueued again by the restore

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

### Requirement: A cleared deadline silences the period's reminder automation

A period whose `deadline` was explicitly cleared has no reference point for
deadline-relative automation. The due-rule dispatch queries are the enforcing mechanism: rules
belonging to a deadline-less report MUST never be returned as due, even when
the rules materialized before the clear. New rules are never materialized for
a deadline-less period; deadline edits atomically reconcile the period and
pause any current rule that no longer has a schedule identity.
The submit deadline gate MUST treat a null deadline as an explicit skip —
`late` stays false, nothing throws, and the skip is logged with the report id
so a missing late stamp is always traceable.

#### Scenario: Materialized rules stop dispatching after a clear

- **GIVEN** an active deadline (or escalation) rule whose `fireAt` has passed
- **WHEN** the admin clears the report's deadline and the dispatch query runs
- **THEN** the query returns no due entry for that rule

#### Scenario: Submissions to a deadline-less period are never late

- **GIVEN** a period whose deadline was cleared, with any grace settings —
  including `allowLateSubmissions: false`
- **WHEN** a lead submits a section at any wall-clock time
- **THEN** the submit succeeds with `late: false`
- **AND** the skip is logged at info with the report id

### Requirement: Reminder creation is atomically limited to editable reports

Automated and manual dispatch MUST use the same complete editable-report
predicate: the report has a deadline, is not archived, has `periodState: open`,
and carries either the initial `{ status: draft, periodStatus: open }` tuple or
the reopened `{ status: published, periodStatus: reopened }` tuple. A manually
or automatically published report MUST NOT dispatch until it is reopened.
Immediately before creating or explicitly reviving an execution, the write path
MUST atomically lock and revalidate the active rule, its owning report, the rule
fire time, its exact owning policy, and this editable lifecycle. The policy MUST
still be active, and the rule MUST still be the current schedule derived from
that policy and the report. The persisted payload kind, deadline, and UTC cycle
date MUST equal the locked rule's immutable kind, deadline, and `fireAt` date.
Creation, failed-row revival, or deduplication MUST be one transaction outcome;
a due-query or pre-write rule lookup alone is not sufficient eligibility.

#### Scenario: Publication wins after due discovery

- **GIVEN** a worker read an active rule as due while its report was editable
- **WHEN** publication commits before the worker attempts execution creation
- **THEN** the atomic write guard creates no execution
- **AND** no reminder job or email is dispatched

#### Scenario: Reopening restores reminder eligibility

- **GIVEN** a published report whose rules were paused at publication
- **WHEN** the report enters the coherent reopened lifecycle tuple
- **THEN** the same transaction reconciles current policies and the persisted
  report deadline before automated or manual dispatch becomes eligible again

### Requirement: Execution schedule is the owning rule fire time

Every reminder-execution read model MUST derive `scheduledFor` from the owning
rule's `fireAt`. It MUST NOT substitute the execution row's `createdAt`, because
delivery can be requested or recovered after the scheduled instant.

#### Scenario: A late-created execution retains its original schedule

- **GIVEN** an execution whose `createdAt` differs from its rule's `fireAt`
- **WHEN** the execution is read by id or through a paginated list
- **THEN** both projections expose `scheduledFor` equal to `rule.fireAt`

### Requirement: Automatic ticks never revive terminal failures

A `failed` execution is terminal for automated scheduling. A later scheduler
tick that resolves the same dedupe key MUST NOT move it back to `queued` and
MUST NOT enqueue another email. Only an explicit user-triggered manual
redispatch may opt into the guarded `failed → queued` transition.

#### Scenario: The next tick follows a final delivery failure

- **GIVEN** an execution exhausted its delivery attempts and is `failed`
- **WHEN** the automatic scheduler sees the same due rule on its next tick
- **THEN** it creates no new execution and enqueues no email
- **AND** the failed row remains terminal

#### Scenario: A user explicitly redispatches a failed reminder

- **GIVEN** a failed execution and a still-editable report
- **WHEN** an authorized user invokes manual redispatch
- **THEN** the service may atomically revive that execution under the same
  rule/report lifecycle lock and enqueue only after commit

#### Scenario: Publication wins after manual rule lookup

- **GIVEN** manual redispatch read an active rule for a failed execution
- **WHEN** publication commits before the atomic revival decision
- **THEN** the failed execution remains terminal
- **AND** no reminder job or email is dispatched

### Requirement: Deadline content freezes the rule deadline

A deadline reminder's persisted payload MUST copy the owning
version's immutable `ReminderRule.deadline`. A live execution guard MUST prove
that this rule version still matches the current `Report.deadline` and active
policy before inserting or reviving an execution. Historical executions remain
valid after a later report deadline or policy edit because their rule version
is never rewritten. `ReminderRule.fireAt` remains the schedule and dedupe cycle
source. Email subject, preview, and body MUST NOT claim a fixed 24-hour offset
because reminder policies permit arbitrary offsets. The content MUST state the
exact frozen deadline or use neutral reminder wording.

#### Scenario: A non-24-hour policy dispatches

- **GIVEN** a deadline rule whose `fireAt` is not 24 hours before the report
  deadline
- **WHEN** its execution and email are created
- **THEN** `scheduledFor` equals `rule.fireAt`
- **AND** `deadlineIso` equals the locked rule version's `deadline`, which was
  current for the report at execution creation
- **AND** no subject, preview, or body claims that 24 hours remain

### Requirement: Derived schedules reconcile atomically without rewriting history

Once a reminder rule has an execution, that version freezes `kind`, `timezone`,
`deadline`, and `fireAt`. After a deadline or policy edit, the writer MUST lock
policies in stable id order, then the affected reports, then reconcile derived
rules in the same transaction. A changed rule with no executions MAY be updated
in place. A changed rule with executions MUST be paused and replaced by the
next version; its executions and immutable payloads MUST NOT be rewritten.
Saving a new active policy MUST materialize rules for all current scheduled and
editable reports. Saving an inactive policy MUST pause all of its active rule
versions, including rules for scheduled reports.

Every lifecycle writer uses the same boundary: publication and archive
transitions pause active rules atomically; scheduled-to-open, reopen, and
unarchive-to-editable transitions reconcile against the persisted deadline and
current policies before commit. Current rule eligibility requires the complete
scheduled or editable lifecycle tuple rather than `periodState` alone.

#### Scenario: An executed schedule changes

- **GIVEN** a rule version has at least one execution
- **WHEN** its report deadline or owning policy schedule changes
- **THEN** the existing version is paused without changing its immutable facts
- **AND** the next version represents the current schedule

#### Scenario: A stale due payload crosses a policy edit

- **GIVEN** a due scan built payload A from rule schedule A
- **WHEN** a policy edit reconciles that rule to schedule B before execution
  creation
- **THEN** the locked creation guard rejects payload A
- **AND** neither an execution nor an email is created from stale facts

#### Scenario: A closed report changes lifecycle

- **GIVEN** an active rule for an editable report
- **WHEN** manual or automatic publication or archive commits
- **THEN** the same transaction pauses its active rule versions
- **AND** a later reopen or editable unarchive reconciles current policy and
  deadline facts before reactivating dispatch

### Requirement: Policy activation and derived rule status are atomic

Every reminder policy MUST use one supported kind/audience pair:
`deadline → lead-with-draft` or `escalation → head-of-late`. Shared input and
admin-recovery validation MUST reject the two cross-paired combinations, and
the canonical database CHECK MUST enforce the same current-only contract for
direct writes.

#### Scenario: a policy cross-pairs kind and audience

- **WHEN** a client or recovery payload supplies `deadline → head-of-late` or
  `escalation → lead-with-draft`
- **THEN** validation rejects the policy before its write transaction
- **AND** a direct database write is rejected by the canonical CHECK

Saving `ReminderPolicy.active` and cascading the corresponding active/paused
status to its derived rules MUST occur in one database transaction. A committed
inactive policy MUST never coexist with an active derived rule visible to due
queries or the execution-creation guard. Rule materialization MUST serialize on
each policy row with `SELECT ... FOR UPDATE`, then re-read and revalidate its
active flag and validity window before creating or updating a rule. Policy
writes and materialization therefore share the same row-lock boundary. Admin
recovery MUST use that same policy-first, derived-rules-second lock order.
Repair materialization MUST recheck the latest rule version only after acquiring
the policy and report locks, then reconcile it according to the immutable
version contract above.

#### Scenario: Disable wins after due discovery

- **GIVEN** a scheduler read a rule as due
- **WHEN** policy disable commits before execution creation
- **THEN** the derived rule is already paused in the same commit
- **AND** no execution or email is created from the stale due result

#### Scenario: Derived-status cascade fails

- **WHEN** the policy row upsert succeeds inside the transaction but the rule
  status cascade fails
- **THEN** the entire policy save rolls back

#### Scenario: Disable wins after stale policy discovery

- **GIVEN** the applicator discovered an active policy before an administrator
  disabled it
- **WHEN** disable commits before the applicator obtains the policy lock
- **THEN** the locked re-read sees the inactive policy and skips materialization
- **AND** neither an existing paused rule nor a not-yet-created rule becomes
  active

#### Scenario: Restore creates a rule while repair waits for the policy lock

- **GIVEN** repair discovered an active policy before admin recovery committed
  its exact restored rule
- **WHEN** repair acquires the policy lock after recovery commits
- **THEN** its in-transaction existence check observes the restored rule
- **AND** repair skips it without changing status, schedule, or payload identity

### Requirement: Manual Remind identifies a sendable deadline rule

The weekly report read model MUST expose the exact active `deadline` rule id
that matches the report's current deadline and active policy. The manual Remind
mutation MUST accept that explicit rule id and revalidate it against the target
report. An active escalation rule alone MUST NOT enable the control, and the
server MUST NOT select an arbitrary active rule by report id.

#### Scenario: Only escalation is active

- **GIVEN** an editable report has an active escalation rule but no current
  active deadline rule
- **WHEN** the report UI and manual reminder capability are rendered
- **THEN** Remind is unavailable
- **AND** no dispatch lookup falls through to the escalation rule

#### Scenario: The UI submits a stale deadline rule id

- **GIVEN** the report read model exposed deadline rule A
- **WHEN** reconciliation replaces A before the user submits Remind
- **THEN** the mutation rejects A during server-side current-rule validation
- **AND** creates no execution or email

### Requirement: Deactivated users never enter reminder recipient discovery

Every automated and manual reminder recipient query MUST require
`User.isActive: true`. This includes draft lead recipients, escalation source
leads and destination heads, manual lead targeting, manual draft-section
dispatch, and recipient allowlists. Deactivation MUST take effect from the next
query without relying on notification preferences.

#### Scenario: A draft lead is deactivated before dispatch

- **GIVEN** a user still owns a draft section but `isActive` is false
- **WHEN** automated or manual recipient discovery runs
- **THEN** the user is absent from the recipient set
- **AND** no reminder execution or email is created for that user

#### Scenario: A deactivated lead is targeted manually

- **GIVEN** a manual dispatch request names an inactive lead id
- **WHEN** scope and recipient discovery run
- **THEN** the target fails closed as out of scope
- **AND** no dispatch is attempted

### Requirement: Stale sending records an unknown delivery outcome

SMTP dispatch and the database status write are not one atomic operation, so a
worker crash while `sending` cannot prove whether delivery happened. Once the
conservative sending timeout expires, the reaper MUST transition the row to
terminal `failed` with an explicit unknown-delivery error. It MUST NOT fabricate
`sent` and MUST NOT automatically retry. The transition count MUST increment
`cr_reminder_delivery_uncertain_total` and emit an operational warning.

#### Scenario: Worker crashes before SMTP

- **GIVEN** a worker claimed an execution and crashed before SMTP accepted it
- **WHEN** the sending timeout expires
- **THEN** the execution becomes an unknown-delivery terminal failure
- **AND** automation does not resend it

#### Scenario: Worker crashes after SMTP but before the sent write

- **GIVEN** SMTP accepted the email but the worker crashed before persisting
  `sent`
- **WHEN** the sending timeout expires
- **THEN** the indistinguishable execution receives the same unknown-delivery
  terminal failure and observability signal
- **AND** only an explicit manual decision can redispatch it
