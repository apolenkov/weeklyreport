## 1. Query policy

- [x] 1.1 Remove global `placeholderData: keepPreviousData` from `apps/web/src/lib/query-client.ts` and update query-client tests to assert the safe default
- [x] 1.2 Inventory every local `keepPreviousData` candidate and opt in only audited identity-stable list/pagination queries with an inline safety rationale (no existing query met all three safety criteria, so no local opt-in was added)

## 2. Report consumer coverage

- [x] 2.1 Audit report-by-id consumers in head/viewer shells, `WeeklyReportPage`, lead form, print, publish/revoke actions, and slides for assumptions that placeholder data is successful current-report data
- [x] 2.2 Add a deferred-response test proving head period A content and publish/reopen controls disappear after navigation selects period B
- [x] 2.3 Add equivalent viewer and lead tests proving previous-period body data and report-scoped actions are absent while the new report key is pending
- [x] 2.4 Add print and slides transition tests proving a new report id renders the pending state instead of cached prior-report content
- [x] 2.5 Add focused tests for every explicit safe-query `keepPreviousData` opt-in (not applicable: the audit added no local opt-ins)

## 3. Repo gates

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm typecheck`
- [ ] 3.3 `pnpm lint`
- [ ] 3.4 `pnpm test`

Scoped web verification used for this frontend-only change:

- `pnpm --filter @customreport/web typecheck` — passed.
- ESLint with `--max-warnings 0` over every changed `apps/web` file — passed.
- Vitest over every changed test file — 7 files and 19 tests passed.
- API generation and the full monorepo typecheck, lint, and test commands were not run.
