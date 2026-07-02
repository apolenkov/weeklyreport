## ADDED Requirements

### Requirement: Reminder Execute Is Scoped to the Caller's Group

The `reminders.execute` tRPC procedure SHALL reject a `ruleId` or
`recipientEmail` outside the non-admin caller's authorized group before
requesting any reminder execution.

The procedure (`apps/api/src/infrastructure/trpc/trpc.router.ts`, the
`reminders.execute` mutation) MUST thread `ctx.session` into its handler.
For a non-admin head it MUST load the `ReminderRule` named by `ruleId`,
resolve the rule's `reportId`, and confirm that report has at least one
`ReportSection` whose author falls inside `groupScopeFilter(session,
"reportSection")`. It MUST also confirm `recipientEmail` belongs to a
draft-section author within that same scope on that report, so the
procedure cannot be used as an open mailer to an arbitrary address. An
admin session carries no scope filter and retains god-mode access.

#### Scenario: Head executes a reminder for an in-scope rule and recipient

- **GIVEN** a head authenticated for group A
- **AND** a `ReminderRule` whose report has a group-A draft-section author with email `lead-a@org`
- **WHEN** the head calls `reminders.execute` with that `ruleId` and `recipientEmail = lead-a@org`
- **THEN** the procedure requests the reminder execution and returns its result

#### Scenario: Head executes a reminder for an out-of-scope rule

- **GIVEN** a head authenticated for group A
- **AND** a `ReminderRule` whose report has only group-B section authors
- **WHEN** the head calls `reminders.execute` with that group-B `ruleId`
- **THEN** the procedure rejects with a FORBIDDEN error
- **AND** no reminder execution is requested

#### Scenario: Head executes a reminder to an arbitrary recipient email

- **GIVEN** a head authenticated for group A
- **AND** an in-scope `ruleId` for a group-A report
- **WHEN** the head calls `reminders.execute` with `recipientEmail` that is not a draft-section author within the head's scope on that report
- **THEN** the procedure rejects with a FORBIDDEN error
- **AND** no reminder execution is requested

#### Scenario: Admin executes a reminder for any rule

- **GIVEN** an admin session
- **WHEN** the admin calls `reminders.execute` with any `ruleId` and `recipientEmail`
- **THEN** no group-scope filter is applied and the execution proceeds

### Requirement: Reminder Execution Listing Is Scoped to the Caller's Group

The `reminders.listExecutions` tRPC procedure SHALL reject a `ruleId`
whose report is outside the non-admin caller's authorized group, AND SHALL
filter the returned execution rows to recipients inside the caller's scope,
before returning any execution rows.

The procedure (`apps/api/src/infrastructure/trpc/trpc.router.ts`, the
`reminders.listExecutions` query) MUST thread `ctx.session` into its
handler. For a non-admin head it MUST load the `ReminderRule` named by
`ruleId`, resolve its `reportId`, and confirm that report has at least one
`ReportSection` author inside `groupScopeFilter(session, "reportSection")`
before listing executions. Because a `ReminderRule` is rule-wide and a
shared report can carry both in-scope and out-of-scope section authors, the
rule-level check alone is insufficient: the report-passes check would let a
group-A head read group-B execution rows, whose `recipientEmail` /
`dedupeKey` expose out-of-group lead identities. The procedure MUST
therefore additionally drop every returned execution whose `recipientEmail`
is not an in-scope recipient — that is, not the email of a `ReportSection`
author within `groupScopeFilter(session, "reportSection")` on that report
and not the caller's own email (escalation reminders addressed to the head
themself). This recipient filter MUST be applied BEFORE cursor pagination
computes the page and `nextCursor`, because the service paginates the
repository's unscoped newest-100 slice; filtering the already-paginated page
would let out-of-scope rows consume the page size or surface as the cursor.
An admin session bypasses both the rule-level check and the recipient filter.

#### Scenario: Head lists executions for an in-scope rule

- **GIVEN** a head authenticated for group A
- **AND** a `ReminderRule` whose report has a group-A section author
- **WHEN** the head calls `reminders.listExecutions` with that `ruleId`
- **THEN** the procedure returns the rule's execution rows

#### Scenario: Head lists executions for an out-of-scope rule

- **GIVEN** a head authenticated for group A
- **AND** a `ReminderRule` whose report has only group-B section authors
- **WHEN** the head calls `reminders.listExecutions` with that group-B `ruleId`
- **THEN** the procedure rejects with a FORBIDDEN error
- **AND** no execution rows from group B are returned

#### Scenario: Head lists executions for a mixed-scope shared report

- **GIVEN** a head authenticated for group A
- **AND** a `ReminderRule` whose report has both group-A and group-B draft-section authors
- **AND** execution rows exist for both a group-A recipient and a group-B recipient
- **WHEN** the head calls `reminders.listExecutions` with that `ruleId`
- **THEN** the procedure returns only the execution rows whose recipient is in group A
- **AND** no group-B recipient email or dedupe key is present in the response

#### Scenario: Mixed-scope listing paginates over the scoped set

- **GIVEN** a head authenticated for group A
- **AND** a `ReminderRule` whose newest executions interleave group-A and group-B recipients
- **WHEN** the head pages through `reminders.listExecutions` with a limit
- **THEN** each page contains only group-A recipient rows up to the limit
- **AND** the returned `nextCursor` is a group-A execution id, never a group-B id

#### Scenario: Admin lists executions for any rule

- **GIVEN** an admin session
- **WHEN** the admin calls `reminders.listExecutions` with any `ruleId`
- **THEN** no group-scope filter is applied and the executions are returned

### Requirement: Reminder Dispatch Is Scoped to In-Group Draft Authors

The `reminders.dispatchPending` tRPC procedure SHALL restrict the
draft-section authors it dispatches to, and any optional `leadId`, to the
non-admin caller's authorized group, in addition to its existing
active-report guard.

The procedure (`apps/api/src/infrastructure/trpc/trpc.router.ts`, the
`reminders.dispatchPending` mutation) MUST keep the existing
`ctx.session.activeReportId === input.reportId` guard. For the bulk path (no
`leadId`) and a non-admin head it MUST spread `groupScopeFilter(session,
"reportSection")` into the `draftSections` `findMany` so a shared or
cross-group active report cannot fan a reminder out to out-of-group leads.
When a `leadId` is supplied, the group-scope check on the lead MUST be
evaluated against the `User` row via `groupScopeFilter(session, "user")`
(which filters `User.reportingGroupId` directly), NOT against a
`ReportSection`, because a section may not exist yet and a section-based check
cannot distinguish an in-scope lead with no section from an out-of-scope lead.
This keeps the existing `no-matching-section` result a valid success state for
an in-scope lead with no draft section (already submitted, or no section yet).
The procedure MUST reject with FORBIDDEN only when the supplied `leadId` user
is outside the caller's scope (or does not exist); an in-scope `leadId` with
zero draft sections MUST still return the `no-matching-section` result, not
FORBIDDEN. An admin session applies no scope filter.

#### Scenario: Head dispatches to all in-scope pending authors

- **GIVEN** a head authenticated for group A with group A as the active report
- **AND** the active report has draft sections by group-A and group-B authors
- **WHEN** the head calls `reminders.dispatchPending` for that report with no `leadId`
- **THEN** only the group-A draft authors are dispatched
- **AND** no group-B author receives a reminder

#### Scenario: Head dispatches to an out-of-scope lead

- **GIVEN** a head authenticated for group A with group A as the active report
- **WHEN** the head calls `reminders.dispatchPending` with a `leadId` whose author is in group B
- **THEN** the procedure rejects with a FORBIDDEN error
- **AND** no reminder is dispatched

#### Scenario: Head dispatches to an in-scope lead with no draft section

- **GIVEN** a head authenticated for group A with group A as the active report
- **AND** a group-A lead whose section is already submitted or absent
- **WHEN** the head calls `reminders.dispatchPending` with that in-scope `leadId`
- **THEN** the procedure does not reject with FORBIDDEN
- **AND** it returns the `no-matching-section` result with zero dispatched

#### Scenario: Admin dispatches across groups

- **GIVEN** an admin session
- **WHEN** the admin calls `reminders.dispatchPending` for a report with cross-group draft authors
- **THEN** no group-scope filter is applied and every pending author may be dispatched

### Requirement: Cross-Group Reminder Access Is Covered by a Regression Test

A regression test SHALL prove that a head authenticated for group A is
rejected when targeting group B's `ruleId`, `reportId`, or `leadId` through
the reminder procedures, and that no group-B data is returned.

The test MUST exercise `reminders.execute`, `reminders.listExecutions`, and
`reminders.dispatchPending` with a group-A head against group-B targets and
assert a FORBIDDEN-equivalent rejection with no group-B rows leaking into
the response. This mirrors the regression-test requirement of the sibling
`repository-scope-guard` capability.

#### Scenario: Group-A head targets group-B reminder data

- **GIVEN** a head authenticated for group A
- **AND** seeded group-B reminder rules, reports, and leads
- **WHEN** the test calls each reminder procedure with the group-B target
- **THEN** every call rejects with a FORBIDDEN-equivalent error
- **AND** the response contains no group-B rule, execution, or lead data
