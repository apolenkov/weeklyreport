## ADDED Requirements

### Requirement: Escalation Recipient Resolves By Head Role

The system SHALL resolve the T+2h escalation digest recipient by head role —
the head of the reporting group whose late leads the digest aggregates — and
MUST NOT resolve it from `report.publishedBy`.

Escalation fires while the late leads' `ReportSection` rows are still in
`draft`, which is before the head publishes the period. Resolving the recipient
as the report's publisher
(`apps/api/src/modules/reminders/reminders.prisma-repository.ts::findDueEscalationRules`)
therefore yields `null` in the normal escalation state and silently drops the
digest. The recipient MUST instead be the active head of the reporting group
the late lead belongs to: a `User` whose `role` is `head` referenced by the
late lead's `ReportingGroup.headUserId` (a `ReportingGroup.head` whose role is
`head` or `admin` per the application-level invariant). The digest MUST fire
regardless of the period's `periodStatus` / publish state. A late lead whose
reporting group has no assigned head (`headUserId = null`) yields no digest for
that lead and MUST be logged, not silently swallowed without trace; it MUST NOT
abort digests for late leads in other groups.

#### Scenario: Escalation fires for an unpublished period

- **WHEN** an escalation rule's `fireAt` is in the past, the period is not
  published (`publishedBy` is `null`), and at least one lead's section is still
  `draft`
- **THEN** the digest recipient resolves to the head of the late lead's
  reporting group via `ReportingGroup.headUserId`
- **AND** the escalation digest is dispatched to that head
- **AND** the absence of `publishedBy` does not skip the rule

#### Scenario: Each group head receives only their group's late leads

- **WHEN** late leads in two different reporting groups exist for the same
  escalation rule
- **THEN** each group's head receives a digest aggregating only that group's
  late leads
- **AND** no head receives late leads from a group they do not head

#### Scenario: A group with no assigned head is logged, not silently dropped

- **WHEN** a late lead belongs to a reporting group whose `headUserId` is
  `null`
- **THEN** no digest is sent for that lead
- **AND** the unresolved-head case is logged
- **AND** digests for late leads in other groups are still dispatched

### Requirement: Reminder Execution Dedupe Is Atomic Insert-On-Conflict

The system SHALL deduplicate a reminder execution with a single atomic
insert-on-conflict against the `ReminderExecution.dedupeKey` unique index, and
MUST NOT use a separate read-then-write (check-then-insert) for dedupe.

`RemindersService.requestReminderExecution`
(`apps/api/src/modules/reminders/reminders.service.ts`) currently calls
`findExecutionByDedupeKey` and then `saveExecution`; two overlapping scheduler
ticks both observe no row and both proceed. The dedupe MUST collapse into one
database operation — an insert that, on conflict with an existing `dedupeKey`,
does not create a second row — and that operation MUST report to the caller
whether THIS call inserted a new row or hit an existing one. The
`dedupeKey` shape MUST remain
`${rule.id}:${kind}:${cycleDate}:${recipientEmail}` for payload callers and the
legacy `${rule.id}:${fireAt.toISOString()}:${recipientEmail}` for payload-less
callers, so existing rows continue to dedupe.

#### Scenario: Two concurrent ticks create one execution row

- **WHEN** two `requestReminderExecution` calls with the same `dedupeKey` run
  concurrently and both reach the insert
- **THEN** exactly one row is inserted with that `dedupeKey`
- **AND** the conflicting call observes the existing row rather than creating a
  duplicate
- **AND** the unique index on `dedupeKey` is the conflict target

#### Scenario: A repeat tick within one cycle is idempotent

- **WHEN** a second tick within the same UTC cycle requests an execution whose
  `dedupeKey` already exists
- **THEN** no new execution row is created
- **AND** the existing execution is returned as the result

### Requirement: Email Job Is Enqueued Only After the Execution Row Commits

The system SHALL enqueue the BullMQ email job only after the execution row is
durably committed AND only for the call that actually inserted the row.

Today the enqueue in `requestReminderExecution` runs unconditionally after the
upsert, so a redundant concurrent call still adds a `send` job. The enqueue
MUST be gated on the atomic insert having created a new row (the
insert-on-conflict result), and MUST happen after that row commits — never
before — so a worker that reads the execution by `executionId` always finds a
committed row and a deduplicated call enqueues nothing.

#### Scenario: A deduplicated call enqueues no job

- **WHEN** `requestReminderExecution` hits an existing `dedupeKey` row instead
  of inserting a new one
- **THEN** no `send` job is added to the email queue
- **AND** the existing execution is returned without side effects

#### Scenario: The job is enqueued after the row is committed

- **WHEN** `requestReminderExecution` inserts a new execution row
- **THEN** the `send` job is enqueued only after that row is committed
- **AND** the job's `executionId` references a row a worker can read
- **AND** exactly one `send` job exists for that execution
