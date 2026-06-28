## 1. API — reminders.execute

- [ ] 1.1 Thread `ctx` into the `reminders.execute` mutation handler in `apps/api/src/infrastructure/trpc/trpc.router.ts`.
- [ ] 1.2 Load the `ReminderRule` by `input.ruleId` and resolve its `reportId`; throw `FORBIDDEN` when no rule exists.
- [ ] 1.3 For a non-admin session, assert the rule's report has a section author inside `groupScopeFilter(ctx.session, "reportSection")`; throw `FORBIDDEN` otherwise.
- [ ] 1.4 For a non-admin session, assert `input.recipientEmail` is a draft-section author within that scope on the report; throw `FORBIDDEN` otherwise (close the open-mailer hole).
- [ ] 1.5 Leave admin sessions unfiltered (helper returns `{}`); call `requestReminderExecution` only after the checks pass.

## 2. API — reminders.listExecutions

- [ ] 2.1 Thread `ctx` into the `reminders.listExecutions` query handler.
- [ ] 2.2 Load the `ReminderRule` by `ruleId`, resolve `reportId`, and for a non-admin session assert an in-scope section author exists; throw `FORBIDDEN` otherwise.
- [ ] 2.3 Return the execution rows only after the scope check; keep existing pagination behavior.

## 3. API — reminders.dispatchPending

- [ ] 3.1 Spread `groupScopeFilter(ctx.session, "reportSection")` into the `draftSections` `findMany` `where`, alongside the existing `reportId`/`status`/`leadId` clauses.
- [ ] 3.2 When `input.leadId` is supplied and resolves to zero in-scope sections, throw `FORBIDDEN` (out-of-scope lead) instead of returning the silent `no-matching-section` reason.
- [ ] 3.3 Keep the existing `activeReportId === reportId` guard and admin god-mode behavior unchanged.

## 4. Tests

- [ ] 4.1 Add a cross-group regression test: a head in group A is rejected (`FORBIDDEN`) calling `execute`, `listExecutions`, and `dispatchPending` with group-B `ruleId`/`reportId`/`leadId`, with no group-B data in the response.
- [ ] 4.2 Add positive-path tests: an in-scope head succeeds, and the `recipientEmail` open-mailer case is rejected.
- [ ] 4.3 Add an admin-path test confirming admin reaches every reminder procedure unfiltered.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck` and `pnpm lint` until green.
- [ ] 5.2 Run `pnpm test` for the reminders/router scope coverage until green.
- [ ] 5.3 Run `openspec validate "scope-reminder-authz" --strict` until it exits 0.
