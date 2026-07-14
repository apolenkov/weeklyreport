## 1. Slice A — re-derive the active-report gate from the DB

- [ ] 1.1 `apps/api/src/infrastructure/trpc/routers/reminders.router.ts`:
      in `dispatchPending`, replace the `ctx.session.activeReportId`
      comparison with a call to `weeklyReportService.getCurrentEditableId()`
      and compare `input.reportId` against that DB-resolved value; keep the
      `FORBIDDEN "report-not-active"` error shape for the caller
- [ ] 1.2 Add `apps/api/src/infrastructure/trpc/routers/reminders.router.test.ts`
      (new file): assert `dispatchPending` succeeds when `input.reportId`
      matches `getCurrentEditableId()` even though `ctx.session.activeReportId`
      holds a different (stale) id; assert it still rejects when
      `input.reportId` is not the current editable report

## 2. Slice B — real period label in the legacy queue payload

- [ ] 2.1 `apps/api/src/modules/reminders/reminders-queue-payload.ts`:
      in the legacy (no-`kind`) branch of `buildQueuePayload`, replace
      `reportPeriod: rule.reportId ?? ""` with a formatted period label
      derived from the rule's `periodStart`/`periodEnd` (reuse the existing
      period-label formatter if one is already shared elsewhere; otherwise
      add a small local formatter)
- [ ] 2.2 Add `apps/api/src/modules/reminders/reminders-queue-payload.test.ts`
      (new file): assert the legacy payload's `reportPeriod` is a formatted
      label, not a UUID

## 3. Slice C — push cursor pagination into the query

- [ ] 3.1 `apps/api/src/modules/reminders/reminders.prisma-repository.ts`:
      change `listExecutions` to page at the DB level (Prisma `cursor`/`skip`/`take`
      or an equivalent keyset query) instead of hard-capping `take: 100` and
      relying on an in-memory slice
- [ ] 3.2 Locate and update the in-memory pagination caller in
      `apps/api/src/modules/reminders/reminders.service.ts` to stop
      re-paginating a fixed 100-row slice now that the repository paginates
      correctly
- [ ] 3.3 Add `apps/api/src/modules/reminders/reminders.prisma-repository.test.ts`
      (new file) or extend `reminders.integration.test.ts`: seed >100
      executions for one rule, walk `listExecutions` cursor-by-cursor, assert
      every row is eventually returned and `nextCursor` only goes `null`
      after the true last row

## 4. Spec delta

- [ ] 4.1 `reliable-reminder-delivery`: ADD a requirement that
      `dispatchPending` gates on the DB-resolved current editable report,
      not a session-cached claim
- [ ] 4.2 `reliable-reminder-delivery`: ADD a requirement that reminder
      email payloads never surface a raw report id where a period label is
      expected
- [ ] 4.3 `reliable-reminder-delivery`: ADD a requirement that admin
      execution-history pagination is DB-level and does not truncate past a
      fixed row count

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `cd apps/api && pnpm test:integration`
- [ ] 5.4 `openspec validate reminders-correctness-bundle --strict`
