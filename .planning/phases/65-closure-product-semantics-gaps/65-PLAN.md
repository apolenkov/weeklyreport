# Phase 65 Plan - Closure: Product Semantics Gaps

## Goal

Close product/behavior gaps repeatedly planned in sessions but not yet
implemented or explicitly deferred.

## Scope

- `D-6`: archive snapshot policy.
- `D-8`: period any-day UX.
- `D-16`: priority stage chip style.
- `D-17`: period navigator display.
- `D-29`: head KPI/lead summary metrics.
- `D-34`: viewer vs head semantics.
- `A35`: director-facing UAT via viewer read-only flow unless product reopens
  a real `director` role.

## Deferred Defaults

- Phase 40 background/dark-mode UI remains research-only.
- Phase 54/55 AI/Telegram real provider activation remains deferred.

## Verify

- Each implemented behavior has unit/integration/e2e coverage appropriate to
  its risk.
- Shared schemas are not forked into parallel fields.
- `director` is not added as a role unless a new product decision changes the
  current contract.

## Implementation Status - 2026-05-14

- DONE: `D-6` publish-time snapshot stored on `Report.publishedSnapshot`;
  `publication.publish` and `period.publish` write the snapshot, while
  archive detail and published weekly-report reads prefer the snapshot.
- DONE: `D-8` manual periods can start on any day; service coverage pins a
  Tuesday start and the computed end date.
- DONE: `D-16` priority stage chips collapse long stage scopes and keep
  all-stage priorities explicit.
- DONE: `D-17` period rows show `Week NN, MMM D-D, YYYY` style labels and
  keep lifecycle state in separate current/submitted badges.
- DONE: `D-29` dashboard has per-lead period summary counts.
- DONE: `D-34/A35` viewer published-report regression covers read-only,
  director-facing access without adding a new `director` role.
- VERIFIED:
  - `pnpm exec prisma generate`
  - `pnpm --filter @customreport/web exec vitest run src/components/lead/priorities-section.test.tsx src/components/dashboard/lead-summary-table.test.tsx src/components/lead/period-navigator.test.tsx src/components/weekly-report/period-navigator.test.tsx src/lib/mappers/dashboard.test.ts src/lib/mappers/weekly-report.test.ts src/lib/mappers/lead-history.test.ts src/lib/mappers/lead-form.test.ts src/components/admin/periods-tab.test.tsx`
  - `pnpm --filter @customreport/api exec vitest run src/modules/admin/admin.service.test.ts`
  - `cd apps/api && pnpm exec vitest run --config vitest.integration.config.ts src/modules/publication/publication.integration.test.ts src/modules/archive/archive.integration.test.ts --reporter=verbose --fileParallelism=false`
  - `pnpm exec prisma migrate deploy`
  - `cd apps/web && pnpm exec playwright test e2e/regression-uat-v7.spec.ts --project=chromium --grep "D-34/A35" --reporter=list`
  - `pnpm --filter @customreport/web lint`
  - `pnpm --filter @customreport/api lint`

## Exit

Phase exits when each product semantics item is either implemented with tests
or explicitly deferred with owner/evidence.
