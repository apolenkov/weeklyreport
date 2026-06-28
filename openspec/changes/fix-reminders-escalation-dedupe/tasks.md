## 1. API — escalation recipient by head role

- [ ] 1.1 In `reminders.prisma-repository.ts::findDueEscalationRules`, replace the
      `report.publishedBy` include with a join from each late lead's `author` to
      `reportingGroup.head` (`ReportingGroup.headUserId`, role `head`/`admin`).
- [ ] 1.2 Group late leads by their reporting group's head and emit one
      `DueEscalationRule`-equivalent per `(rule, group head)` aggregating only
      that group's late leads; drop the publish-state dependency.
- [ ] 1.3 Log late leads whose reporting group has `headUserId = null` (no digest
      for them) and continue processing other groups; never throw.
- [ ] 1.4 Update the `DueEscalationRule` interface and `RemindersScheduler.dispatchEscalation`
      to consume the per-group-head shape (iterate group heads).

## 2. API — atomic insert-on-conflict dedupe

- [ ] 2.1 Add a repository method that inserts a `ReminderExecution` and on
      `dedupeKey` unique conflict returns the existing row, reporting
      `{ execution, inserted: boolean }` (catch `P2002` narrowly on `dedupeKey`,
      rethrow other codes — mirror `PolicyApplicatorService.applyToPeriod`).
- [ ] 2.2 In `RemindersService.requestReminderExecution`, replace the
      `findExecutionByDedupeKey` + `saveExecution` pair with the atomic method;
      keep both dedupeKey shapes (payload and legacy) unchanged.
- [ ] 2.3 Retire `findExecutionByDedupeKey` from the dispatch path (keep or remove
      from `RemindersRepository` per remaining callers; confirm with grep).

## 3. API — enqueue after commit, gated on insert

- [ ] 3.1 Gate `emailQueue.add('send', ...)` on `inserted === true` so a
      deduplicated call enqueues nothing.
- [ ] 3.2 Ensure the enqueue runs after the insert resolves (committed), with the
      job's `executionId` referencing the committed row.

## 4. Tests

- [ ] 4.1 Escalation fires for an unpublished period (`publishedBy = null`,
      sections still `draft`) and targets the late lead's group head.
- [ ] 4.2 Two-group escalation: each group head receives only their group's late
      leads.
- [ ] 4.3 Head-less group: no digest for that lead, the case is logged, other
      groups still dispatched.
- [ ] 4.4 Two concurrent `requestReminderExecution` calls with the same dedupeKey
      create exactly one row and enqueue exactly one `send` job.
- [ ] 4.5 A deduplicated call (existing dedupeKey) returns the existing execution
      and enqueues no job.

## 5. Verification

- [ ] 5.1 `pnpm typecheck`
- [ ] 5.2 `pnpm lint`
- [ ] 5.3 `pnpm test` (reminders unit + integration suites green)
- [ ] 5.4 `pnpm build`
- [ ] 5.5 `openspec validate "fix-reminders-escalation-dedupe" --strict`
