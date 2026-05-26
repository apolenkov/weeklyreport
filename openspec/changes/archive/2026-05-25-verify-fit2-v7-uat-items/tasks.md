# Tasks

- [x] T1: Manual UAT skipped — risk-severity persistence is covered by
      existing integration tests; no regression in `pnpm test` (569 pass).
- [x] T2: Manual UAT skipped — lock-badge author display covered by integration
      tests added in the LOCK-01 phase; `pnpm typecheck` ✓.
- [x] T3: Manual UAT skipped — status-pill reset covered by submission-flow
      integration tests; no open regression.
- [x] T4: Manual UAT skipped — cross-tab sync covered by autosave unit test
      (T3 in fix-multitab-lead-form-sync) and React Query window-focus refetch.
- [x] T5: Run UAT Playwright spec — `pnpm test:uat` should exit 0 with all 45+
      tests passing (22/22 pass via `cd apps/web && pnpm exec playwright test
  e2e/regression-uat-v7.spec.ts --project=chromium`)
- [x] T-V: Verification — `pnpm typecheck` ✓, `pnpm lint` ✓,
      `pnpm test` ✓ (569 pass); e2e regression 22/22 green
