## Why

The T+2h escalation digest that should warn a head about leads who missed the
deadline almost never reaches anyone, and the hourly reminder tick can email
the same recipient twice. Both undermine the only nudge the system gives before
a report goes out incomplete.

The escalation recipient is resolved as `report.publishedBy`
(`apps/api/src/modules/reminders/reminders.prisma-repository.ts::findDueEscalationRules`,
line 188). But escalation fires precisely while leads are still in `draft` —
that is, before the head has published — so `publishedBy` is `null`, the rule is
skipped (`if (!head) continue;`), and no digest is sent. Separately,
`RemindersService.requestReminderExecution` dedupes with a check-then-insert
(`findExecutionByDedupeKey` then `saveExecution`), and enqueues the BullMQ job
unconditionally after the upsert. Two overlapping ticks both miss the row, both
upsert (collapsing to one row), and both enqueue — two emails for one
execution.

Source: repo-excellence review backlog item `fix-reminders-escalation-dedupe`
(P1), `docs/repo-excellence-review-2026-06-28.md` line 188.

## What Changes

- Resolve the escalation recipient by HEAD role — the active head of the
  reporting group whose leads are late (`ReportingGroup.headUserId`, role
  `head`/`admin`, `isActive = true`) — instead of `report.publishedBy`. The
  digest fires regardless of whether the period has been published, which is the
  normal escalation state; a deactivated head is logged and skipped, not
  targeted.
- Make the dedupe atomic: a single insert-on-conflict on the
  `ReminderExecution.dedupeKey` unique index that reports whether THIS caller
  created the row, replacing the check-then-insert race.
- Enqueue the email job only after the execution row is committed AND only when
  this caller actually inserted it, so a redundant concurrent tick enqueues
  nothing.

## Capabilities

### New Capabilities

- `reminder-dispatch-integrity`: the scheduler's deadline and escalation
  dispatch resolves the escalation recipient by head role, dedupes execution
  rows with an atomic insert-on-conflict, and enqueues the email job only after
  the row commits and only for the caller that inserted it.

### Modified Capabilities

<!-- No existing spec governs the dispatch engine. admin-reminders-ui is
     UI-only and explicitly excludes the scheduler ("The Reminders Engine Is
     Unchanged"). No requirement changes there. -->

## Impact

- `apps/api/src/modules/reminders/reminders.prisma-repository.ts`
  (`findDueEscalationRules` recipient resolution; atomic insert path).
- `apps/api/src/modules/reminders/reminders.service.ts`
  (`requestReminderExecution` dedupe + enqueue ordering).
- `apps/api/src/modules/reminders/reminders.scheduler.ts`
  (`dispatchEscalation` consumes the new recipient shape).
- `RemindersRepository` interface (new atomic insert method; existing
  `findExecutionByDedupeKey` may be retired from the dispatch path).
- No schema change: the `ReminderExecution.dedupeKey @unique` index already
  exists and is the conflict target. No migration (MVP phase).
