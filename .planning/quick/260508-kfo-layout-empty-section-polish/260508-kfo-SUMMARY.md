---
quick_id: 260508-kfo
slug: layout-empty-section-polish
status: completed
date: 2026-05-08
---

# Quick Task 260508-kfo: Layout Empty Section Polish Summary

## Done

- Muted and disabled empty "Blocked & At Risk" dashboard accordion.
- Kept "Lead Reports" body separated from its header with top spacing.
- Muted empty weekly-report product cards and blocked empty product expansion.
- Removed vertical hover movement that pushed cards into section headers.
- Scoped "Toggle All" to product accordions only.
- Fixed nav active state for "/head/report/[reportId]" addressed report pages.
- Narrowed "Archive" nav active state so "/reports/trends" is not highlighted.

## Evidence

- ".planning/regression/evidence/2026-05-08-layout-empty-section-polish/layout-check.json"
- ".planning/regression/evidence/2026-05-08-layout-empty-section-polish/screenshots/dashboard-empty-sections.png"
- ".planning/regression/evidence/2026-05-08-layout-empty-section-polish/screenshots/weekly-report-empty-products.png"

## Verification

- "rtk pnpm --filter @customreport/web exec vitest run src/components/navigation/nav-bar.test.tsx src/components/dashboard/blocked-at-risk-table.test.tsx src/components/weekly-report/weekly-report-page.test.tsx"
  - PASS: 3 files, 23 tests.
- "rtk proxy pnpm --filter @customreport/web typecheck"
  - PASS.
- "rtk proxy pnpm --filter @customreport/web lint"
  - PASS.
- Browser layout sweep:
  - PASS: dashboard empty accordion disabled.
  - PASS: dashboard lead reports body top gap.
  - PASS: weekly report addressed route active nav.
  - PASS: weekly report "Toggle All" disabled when all products are empty.
  - PASS: weekly empty product accordions disabled.
  - PASS: portfolio overview content top gap.

## Not Closed Here

- Phase 16 PDF runtime UAT remains dependent on a published report or reseed.
- Phase 16 theme-toggle UAT remains stale until the product decision is clarified.
- Phase 17 full UAT remains open until all role/domain scenarios are replayed.
