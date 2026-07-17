## 1. Coordinate the existing admin change

- [x] 1.1 Rebase after `admin-presentation-type-ssot` or verify its three model import repoints are present; do not edit `group-form.ts`, `product-form.ts`, or `user-form.ts` for the same change

## 2. Weekly report types

- [x] 2.1 Retype `ProductAccordion`, `PortfolioOverviewTable`, weekly report content/page helpers/view-model, and their tests to `WeeklyProductReport`, `WeeklyPortfolioProduct`, and canonical nested `Weekly*` types
- [x] 2.2 Retype `app/print/[reportId]/print-report-template.tsx` to canonical `Weekly*` types and remove mock-type compatibility annotations
- [x] 2.3 Remove structural casts in `buildWeeklyReportPageView`; correct any missing field at `weekly-report-types.ts` or the live mapper that produces it

## 3. Admin feature presentation types

- [x] 3.1 Repoint remaining live admin UI imports of user/group/product/period/reminder/settings/stage presentation types from `admin-mock-data.ts` to `features/admin/model/admin-types.ts`
- [x] 3.2 Move any residual live presentation declaration absent from `admin-types.ts` into that feature model before removing its mock-module declaration
- [x] 3.3 Update admin tests and fixtures to import feature types and use `satisfies` or direct live-type annotations

## 4. Dead mock cleanup

- [x] 4.1 Audit tracked and untracked consumers of every dashboard/admin `MOCK_*` export plus `getUserById` and `getLeadUsers`
- [x] 4.2 Delete exports and helpers with no remaining consumer; retain only fixtures used by tests/development surfaces and make them satisfy live feature types
- [x] 4.3 Assert no production report/admin module imports presentation types from `dashboard-mock-data.ts` or `admin-mock-data.ts`

## 5. Repo gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck`
- [x] 5.3 `pnpm lint`
- [x] 5.4 `pnpm test`
