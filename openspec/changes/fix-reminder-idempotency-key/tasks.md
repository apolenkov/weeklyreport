# Tasks

## 1. Regression pin — expose the current key divergence

- [ ] 1.1 Add a test that computes the dedupe key `dispatchDraftSections`
      builds locally (`reminders-scope.service.ts:259`) and the key
      `requestReminderExecution` builds internally for the same
      rule/cycle/email when called with no payload
      (`reminders.service.ts:223-225`), and asserts they are
      byte-identical to the key the scheduler's automated deadline path
      builds for the same rule/cycle/email — this test MUST fail against
      current `main` (the legacy `fireAtIso` shape vs. the
      `deadline:${cycleDate}` shape never match).
- [ ] 1.2 Add an integration/unit test: dispatch the automated deadline
      reminder for a rule/lead/cycle, then trigger a manual
      `dispatchPendingReminders` (head `Remind`) for the same rule/lead
      within the same cycle — assert `alreadySent` increments and
      `dispatched` stays `0` (no second email). MUST fail against current
      `main` (currently reports `dispatched: 1`, `alreadySent: 0`).

## 2. Unify the dedupe-key builder

- [ ] 2.1 Extract one exported function that builds the reminder dedupe
      key from `{ ruleId, cycleDate, recipientEmail, kind }` (or the
      narrower `{ ruleId, cycleDate, recipientEmail }` for the `deadline`
      case), replacing the inline template literals in both
      `reminders.service.ts:223-225` and
      `reminders-scope.service.ts:259`.
- [ ] 2.2 `RemindersScopeService.dispatchDraftSections`: derive `cycleDate`
      from `rule.fireAt` the same way `RemindersScheduler.dispatchRule`
      does (UTC `YYYY-MM-DD` truncation), and pass a `deadline`-kind
      payload (or otherwise route through the shared builder) so its call
      to `requestReminderExecution` and its own local read-back key use
      the identical shape the scheduler uses.
- [ ] 2.3 Confirm `extractRecipientEmail`
      (`reminders-row-mappers.ts`) still parses the unified shape
      correctly (it already handles the `kind:cycleDate` shape) — no
      change expected there, verify only.

## 3. Update existing tests for the unified shape

- [ ] 3.1 `reminders.service.test.ts` — adjust any assertion pinned to the
      old no-payload legacy shape (`${ruleId}:${fireAt.toISOString()}:${email}`)
      to the unified `deadline:${cycleDate}` shape where the call site now
      routes through it.
- [ ] 3.2 `reminders.service.scope.test.ts`,
      `reminders.contract.test.ts` — same adjustment for any fixture
      dedupe key built in the old legacy shape.
- [ ] 3.3 `reminders.scheduler.test.ts` — verify the comment at line ~169
      (`${rule.id}:deadline:${cycleDate}:${email}`) and its assertions
      still hold unchanged (scheduler-side shape is the target shape,
      not the one being migrated).
- [ ] 3.4 `reminders.dedupe-key.test.ts` — confirm both parsed shapes
      remain covered; add the unified manual-dispatch shape if not
      already implied by 1.1/1.2.

## 4. Spec delta

- [ ] 4.1 `reliable-reminder-delivery`: ADD the requirement that all
      `requestReminderExecution` callers for the same rule/recipient/cycle
      share one dedupe-key shape (see `specs/reliable-reminder-delivery/spec.md`).

## Gates

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck`
- [ ] 5.3 `pnpm lint`
- [ ] 5.4 `pnpm test`
- [ ] 5.5 `pnpm --filter @customreport/api test:integration`
- [ ] 5.6 `openspec validate fix-reminder-idempotency-key --strict`
