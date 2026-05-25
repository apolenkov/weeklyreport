# Tasks

## Scope-access audit

- **SCOPE-T1** Grep all tRPC procedure implementations for `findDraftSections`,
  `findReports`, period queries; list call sites with line refs
- **SCOPE-T2** For each call site, inspect middleware chain and document
  whether `RoleBasedAccessGuard` + `groupScope` context is present
- **SCOPE-T3** Identify unguarded paths; propose guard addition or document
  why scope is trusted downstream
- **SCOPE-T4** Add repository-layer assertion `guardGroupScope(groupScope)`
  to `findDraftSections()` and period queries
- **SCOPE-T5** Regression test: create read-only auth + unauthorized group ID,
  assert 403 on all report queries
- **SCOPE-T6** Commit: `security: add scope-access audit + defensive guards to
report repository`

## Verification

```bash
pnpm --filter @customreport/api test -- \
  src/modules/weekly-report/__tests__/scope-access.test.ts
```
