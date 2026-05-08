---
quick_id: 260508-mkb
slug: v8-1-focused-observability-and-ui-polish
status: completed
date: 2026-05-08
---

# Quick Task 260508-mkb: v8.1 Focused Observability and UI Polish Summary

## Done

- Added persistent `UserActionLog` storage with request/correlation id linkage.
- Added `admin.actionLog.list` and Admin `Actions` tab.
- Hid internal manual proof calls from the user-facing Action Log view.
- Added search fields to admin list surfaces:
  - `Users`
  - `Reminders`
  - `Jobs`
  - `Actions`
  - `Products` keeps its existing global search across products and reports.
- Added first-rule creation UI to `/admin?tab=reminders`.
- Clarified `Jobs` as the email-reminder failed-delivery queue, not reminder configuration.
- Renamed Settings copy from department-specific wording to reporting-group wording.
- Removed dashboard-level `Collapse all`.
- Removed duplicate `Lead Reports` dashboard section.
- Kept one dashboard flow: `Submission Activity`.
- Made empty dashboard activity rows muted and non-clickable.
- Kept weekly empty reports non-publishable and without bulk toggle.
- Kept phase 16 PDF/theme/human gates open.

## Evidence

- `.planning/regression/evidence/product-ready-matrix/`
- Live product-ready matrix:
  - 10 passed
  - 1 skipped
  - skip: current fixture has no old-style empty product detail text to target.

## Verification

- `rtk proxy pnpm --filter @customreport/web typecheck`
  - PASS.
- `rtk proxy pnpm --filter @customreport/web test -- src/components/admin/jobs-tab.test.tsx src/components/dashboard/dashboard-page.test.tsx src/components/weekly-report/publish-lock-button.test.tsx src/components/weekly-report/weekly-report-page.test.tsx src/lib/mappers/lead-status.test.ts src/lib/mappers/dashboard.test.ts src/lib/mappers/admin.test.ts`
  - PASS: 35 files, 284 tests.
- `rtk proxy pnpm --filter @customreport/web lint`
  - PASS.
- `rtk proxy pnpm --filter @customreport/api typecheck`
  - PASS.
- `rtk proxy pnpm --filter @customreport/api test -- src/infrastructure/trpc/trpc.context.test.ts src/infrastructure/trpc/mutation-audit.test.ts src/modules/weekly-report/weekly-report.service.test.ts src/modules/weekly-report/weekly-report.contract.test.ts src/modules/weekly-report/weekly-report.integration.test.ts`
  - PASS: 57 files, 658 tests.
- `rtk curl -sS http://localhost:3002/health/ready`
  - PASS: database, redis, bullmq up.
- `rtk proxy pnpm --filter @customreport/web exec playwright test --config=playwright.regression.config.ts e2e/regression/product-ready-matrix.spec.ts --project=chromium`
  - PASS: 10 passed, 1 skipped.

## Not Closed Here

- Phase 16 `human_needed` remains open: PDF export needs real published-report/human evidence.
- Theme toggle remains a product decision because the current UI has no toggle surface.
- `Department` is still deferred as a separate migration-backed domain batch.
- Admin `Users` still has presentation-only `department`; real department assignment belongs to the Department batch.

## Regression Lesson

- The previous regression checked dashboard reminder disabled state but did not check the full configuration path:
  `Dashboard Send Reminder -> Configure reminders -> create active rule -> return to Dashboard`.
- The matrix now needs an explicit scenario for `no reminder rules -> create rule`.
