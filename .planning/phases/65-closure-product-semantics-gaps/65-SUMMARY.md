# Phase 65 Summary - Closure: Product Semantics Gaps

## Status

Completed: 2026-05-14
Result: PASS

## Scope Closed

| ID   | Result                                       | Evidence                                                                                                                     |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| D-6  | Publish-time archive snapshots implemented   | `Report.publishedSnapshot`, `published-report-snapshot.ts`, publication/period publish writers, archive snapshot integration |
| D-8  | Any-day manual period behavior covered       | `admin.service.test.ts` accepts a Tuesday period and verifies the computed period end                                        |
| D-16 | Priority stage chips made compact            | `priorities-section.tsx` collapses long stage scopes and keeps all-stage priorities explicit                                 |
| D-17 | Period labels unified                        | Lead, weekly, admin, history, archive, and print surfaces use shared label helpers with separate state badges                |
| D-29 | Dashboard per-lead summary added             | `LeadSummaryTable` renders lead status, product count, item count, and last activity                                         |
| D-34 | Viewer semantics covered                     | Published archive viewer flow is read-only in Playwright regression                                                          |
| A35  | Director-facing UAT covered without new role | Existing `viewer` role is the director-facing read-only path; runtime `director` role remains absent                         |

## Deferred

| ID      | Decision                                                                              |
| ------- | ------------------------------------------------------------------------------------- |
| UFB-032 | Deferred research-only unless Phase 40 UI/theme implementation is explicitly reopened |
| AI-54   | Real provider activation remains deferred                                             |
| TG-55   | Real Telegram activation remains deferred                                             |

## Files

- `prisma/schema.prisma`
- `prisma/migrations/20260514153000_phase65_published_snapshot/migration.sql`
- `apps/api/src/modules/published-report-snapshot.ts`
- `apps/api/src/modules/publication/publication.prisma-repository.ts`
- `apps/api/src/modules/period/period.prisma-repository.ts`
- `apps/api/src/modules/archive/archive.prisma-repository.ts`
- `apps/api/src/modules/admin/admin.service.test.ts`
- `apps/api/src/modules/publication/publication.integration.test.ts`
- `apps/api/src/modules/archive/archive.integration.test.ts`
- `apps/web/src/components/lead/priorities-section.tsx`
- `apps/web/src/components/lead/priorities-section.test.tsx`
- `apps/web/src/components/dashboard/lead-summary-table.tsx`
- `apps/web/src/components/dashboard/lead-summary-table.test.tsx`
- `apps/web/src/components/dashboard/dashboard-page.tsx`
- `apps/web/src/components/lead/period-navigator.tsx`
- `apps/web/src/components/weekly-report/period-navigator.tsx`
- `apps/web/src/components/admin/periods-tab.tsx`
- `apps/web/src/components/dashboard/report-archive-section.tsx`
- `apps/web/src/components/lead/lead-history-list.tsx`
- `apps/web/src/components/weekly-report/weekly-report-page.tsx`
- `apps/web/src/app/print/[reportId]/page.tsx`
- `apps/web/src/lib/format-date.ts`
- `apps/web/src/lib/mappers/admin.ts`
- `apps/web/src/lib/mappers/dashboard.ts`
- `apps/web/src/lib/mappers/weekly-report.ts`
- `apps/web/e2e/regression-uat-v7.spec.ts`

## Verification

- `pnpm exec prisma generate` - PASS.
- `pnpm --filter @customreport/web exec vitest run src/components/lead/priorities-section.test.tsx src/components/dashboard/lead-summary-table.test.tsx src/components/lead/period-navigator.test.tsx src/components/weekly-report/period-navigator.test.tsx src/lib/mappers/dashboard.test.ts src/lib/mappers/weekly-report.test.ts src/lib/mappers/lead-history.test.ts src/lib/mappers/lead-form.test.ts src/components/admin/periods-tab.test.tsx` - PASS, 9 files / 98 tests.
- `pnpm --filter @customreport/api exec vitest run src/modules/admin/admin.service.test.ts` - PASS, 64 tests.
- `cd apps/api && pnpm exec vitest run --config vitest.integration.config.ts src/modules/publication/publication.integration.test.ts src/modules/archive/archive.integration.test.ts --reporter=verbose --fileParallelism=false` - PASS, 2 files / 7 tests.
- `pnpm exec prisma migrate deploy` - PASS, applied the local additive `customreport_uat` snapshot migration.
- `cd apps/web && pnpm exec playwright test e2e/regression-uat-v7.spec.ts --project=chromium --grep "D-34/A35" --reporter=list` - PASS, 5 tests.
- `pnpm --filter @customreport/web lint` - PASS.
- `pnpm --filter @customreport/api lint` - PASS.

## Notes

- The first Playwright D-34/A35 run exposed local `customreport_uat` schema
  drift: the database did not yet have `Report.publishedSnapshot`. The
  additive migration was applied locally and the regression passed on rerun.
- No runtime `director` role was added.
- Phase 40 background/dark-theme/rebrand work remains out of this closure
  phase unless explicitly reopened.
