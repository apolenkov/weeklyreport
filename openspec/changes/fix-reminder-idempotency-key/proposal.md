## Why

`RemindersScopeService.dispatchDraftSections`
(`apps/api/src/modules/reminders/reminders-scope.service.ts:259`) builds its
local dedupe key as `` `${rule.id}:${fireAtIso}:${section.email}` `` — the
legacy shape — and calls `requestReminderExecution(rule.id, section.email)`
at line 261 with **no** `payload` argument. Per
`reminders.service.ts:223-225`, `requestReminderExecution` without a
`payload` builds that exact same legacy shape internally
(`` `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}` ``), so the
local key and the internal key agree with each other — the race-safe
read-back at line 262 works correctly on its own terms.

The problem is against the _other_ caller. `RemindersScheduler.dispatchRule`
(`reminders.scheduler.ts:104`) calls `requestReminderExecution` **with** a
`{ kind: "deadline", cycleDate, ... }` payload for the automated T-24h send,
which makes the service build the newer shape
`` `${rule.id}:deadline:${cycleDate}:${recipientEmail}` ``
(`reminders.service.ts:223-224`).

These two shapes can never collide for the same rule/lead/cycle:
`fireAtIso` is the rule's precise timestamp while `deadline:${cycleDate}`
is a day-truncated literal. So when a lead has already received the
automated deadline reminder for today's cycle and the head then triggers a
manual `Remind` (which runs through `dispatchPendingReminders` →
`dispatchDraftSections`), the unique-index dedupe never fires: a brand-new
`ReminderExecution` row is inserted, a second email goes out, and
`DispatchPendingResult.alreadySent` is reported as `0` even though the
lead had already been reminded for that cycle. The manual path can never
report a true `alreadySent` against the automated path — only against
itself.

## What Changes

- Extract a single, exported dedupe-key builder used by every caller of
  `requestReminderExecution` — the scheduler's deadline/escalation payload
  path and the manual `dispatchDraftSections` no-payload path alike — so
  there is exactly one function that decides the key shape for a given
  rule/cycle/recipient.
- `dispatchDraftSections`'s manual dispatch derives the same
  `deadline:${cycleDate}` shape (cycleDate = the UTC date of `rule.fireAt`,
  truncated the same way the scheduler already truncates it) instead of the
  full-precision `fireAtIso` legacy shape, so a manual `Remind` collides
  with an already-sent automated reminder for the same rule/lead/day.
- `dispatchDraftSections`'s own local `dedupeKey` (used for the race-safe
  read-back at line 262) is computed via the same shared builder it passes
  to `requestReminderExecution`, so the two can never drift apart again.
- Add a regression test that fails on divergence: assert the key
  `dispatchDraftSections` computes locally and the key
  `requestReminderExecution` builds internally for the same rule/cycle/email
  are byte-identical, and assert a manual dispatch after an automated send
  for the same cycle reports `alreadySent`, not a new `dispatched` email.

## Capabilities

### Modified Capabilities

- `reliable-reminder-delivery` — the manual head-triggered `Remind` path now
  shares one canonical dedupe-key shape with the automated scheduler tick, so
  it can no longer send a duplicate reminder for a cycle the lead already
  received.

## Impact

- `apps/api/src/modules/reminders/reminders-scope.service.ts` —
  `dispatchDraftSections`'s dedupe-key construction and its
  `requestReminderExecution` call.
- `apps/api/src/modules/reminders/reminders.service.ts` —
  `requestReminderExecution`'s no-payload dedupe-key branch (and/or the
  extraction point for the shared builder).
- `apps/api/src/modules/reminders/reminders-row-mappers.ts` — read-only
  reference; `extractRecipientEmail` already parses both key shapes and is
  unaffected as long as the unified shape stays `:`-delimited with the email
  last.
- Tests: `reminders.service.test.ts`, `reminders.scheduler.test.ts`,
  `reminders.contract.test.ts`, `reminders.service.scope.test.ts`,
  `reminders.dedupe-key.test.ts` — extend/adjust for the unified shape; add
  the cross-caller divergence regression test.

## Non-goals

- Not changing the escalation dedupe-key shape (`kind: "escalation"`) —
  escalation digests have no manual-dispatch counterpart to collide with.
- Not changing the `ReminderExecution.dedupeKey` column, its unique index,
  or the P2002 conflict-detection helper in `reminders-row-mappers.ts`.
- Not backfilling or migrating existing `ReminderExecution` rows already
  persisted under the old legacy shape — this is a forward-only fix for new
  dispatches.
- Not touching `dispatchEscalation` or any other `requestReminderExecution`
  call site beyond `dispatchDraftSections` and the shape it now shares with
  `dispatchRule`.
