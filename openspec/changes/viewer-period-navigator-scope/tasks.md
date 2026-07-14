## 1. `PeriodNavigator`: accept an explicit current-period id

- [ ] 1.1 `apps/web/src/features/period/ui/period-navigator.tsx`: add
      `currentPeriodId?: string` to `PeriodNavigatorProps`, documented as
      taking precedence over the `pathname` regex when supplied
- [ ] 1.2 Update the `currentIndex` memo to resolve `pathReportId ??
currentPeriodId ?? null` (prop wins when both would apply; explicit
      wins over inference) before falling back to index `0`
- [ ] 1.3 `apps/web/src/features/period/ui/period-navigator.test.tsx`: add a
      case with a pathname that does not match the regex (e.g.
      `/reports/2026-W16`) and `currentPeriodId="2026-W16"`, asserting the
      trigger label, listbox highlight, and Prev/Next targets resolve to
      `2026-W16`, not index `0`
- [ ] 1.4 Add a case where `currentPeriodId` is supplied alongside a
      matching pathname, asserting no regression (both agree, index
      resolves the same)

## 2. Wire the viewer route

- [ ] 2.1 `apps/web/src/features/viewer/ui/viewer-report-shell.tsx`: pass
      `currentPeriodId={reportId}` to `<PeriodNavigator>`
- [ ] 2.2 `apps/web/src/features/viewer/ui/viewer-report-shell.test.tsx`:
      add/extend a case with a `periods` list containing an older
      non-newest entry as the addressed `reportId`, asserting the rendered
      navigator reflects that period (not the newest)

## 3. Live verification

- [ ] 3.1 Boot web+api from source (docker images are stale)
- [ ] 3.2 Dev-login as a viewer with 2+ published periods in an accessible
      group; open History, click an older period
- [ ] 3.3 Confirm trigger label + listbox highlight match the opened
      period, and Prev/Next walk relative to it (not the newest)
- [ ] 3.4 Confirm explicit dropdown re-selection still works (no regression
      on the already-correct path)

## 4. Gates

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `cd apps/web && pnpm exec vitest run src/features/period/ui/period-navigator.test.tsx src/features/viewer/ui/viewer-report-shell.test.tsx`
- [ ] 4.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.4 `openspec validate viewer-period-navigator-scope --strict`
