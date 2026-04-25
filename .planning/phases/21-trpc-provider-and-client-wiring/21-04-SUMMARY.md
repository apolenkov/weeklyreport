---
plan: 21-04
phase: 21-trpc-provider-and-client-wiring
status: complete
completed: 2026-04-25
subsystem: web/lead + web/weekly-report + web/reports-detail
requirements: [TRPC-04, TRPC-05, TRPC-06]
tech-stack:
  patterns:
    - Container lifts useQuery, passes mock-shaped slices to presentational children
    - Composite mappers in apps/web/src/lib/mappers (Zod -> mock-shaped types)
    - Self-contained mapper modules re-declare presentation types (no mock-data dependency)
    - useEffect re-seeds local UI state when query revalidates (isSubmitted from API)
    - TODO(Phase 22) markers at every mutation site for staged hand-off
    - Print page becomes client component for now; Phase 23 owns server-rendered PDF orchestration
key-files:
  created:
    - apps/web/src/lib/mappers/lead-form.ts
    - apps/web/src/lib/mappers/lead-form.test.ts
    - apps/web/src/lib/mappers/weekly-report.ts
    - apps/web/src/lib/mappers/weekly-report.test.ts
    - apps/web/src/components/lead/lead-form-skeleton.tsx
    - apps/web/src/components/weekly-report/weekly-report-skeleton.tsx
  modified:
    - apps/web/src/lib/mappers/index.ts
    - apps/web/src/components/lead/lead-form.tsx
    - apps/web/src/components/weekly-report/weekly-report-page.tsx
    - apps/web/src/app/(app)/reports/[reportId]/page.tsx
    - apps/web/src/app/(app)/reports/[reportId]/print/page.tsx
metrics:
  tasks: 3
  commits: 3
  duration: ~50m
  tests-added: 26
---

# Plan 21-04: Lead Form + Weekly Report Migration — SUMMARY

## One-liner

LeadForm composes 4 useQuery calls (`reports.getActive` + `leadForm.byPeriod` + `leadForm.versions` + `reports.myHistory`) and the WeeklyReportPage / `/reports/[reportId]` / print pages all read from `weeklyReport.get`. Phase 21 read-path migration is complete: no `MOCK_*` value-imports remain anywhere under `apps/web/src`.

## What was built

### Composite mappers

- `mapLeadFormData({ active, byPeriod, versions, history, now? })` — composes 4 endpoints into the LeadForm view.
- `mapLeadProducts(section)` / `mapLeadItems(section, type)` / `mapLeadRisks(section)` / `mapLeadDecisions(section)` / `mapLeadPriorities(section)` / `mapLeadPeriods(history, activeReportId)` / `mapLeadVersions(versions, now)` — fine-grained helpers for tests.
- `mapWeeklyReport(api: WeeklyReportReadModel)` — slices `leadSections` (per-lead) into `portfolio` + `products` (per-product) plus `period` info and `submissionLabel`.
- `formatWeekRange(start, end)` exported helper for date-range formatting.

### UI

- `LeadFormSkeleton` — page-header + period-nav shell + 6 accordion placeholders matching final dimensions.
- `WeeklyReportSkeleton` — page-header + period-nav shell + 6-column portfolio table (header + 8 rows) + 4 accordion placeholders.
- `LeadForm` lifts the 4 queries with `enabled` gating on the dependent `byPeriod` / `versions` queries; renders skeleton during load; toasts each error path; preserves all original handlers as local-only updates with `TODO(Phase 22)` markers (8 markers total).
- `WeeklyReportPage` accepts both `period?: string` and `reportId?: string`; queries `weeklyReport.get` with `{ reportId }` when scoped, else `{}` for active-period default; surfaces `submitted/total` + `pendingCount` for the header badge and `PublishLockButton`.
- `/reports/[reportId]/page.tsx` is now a thin client wrapper using `use(params)` to unwrap the `Promise<{ reportId }>` and forward it to `WeeklyReportPage`.
- `/reports/[reportId]/print/page.tsx` is a client component fetching via `weeklyReport.get({ reportId })`, rendering the same A4-optimized JSX shell (inline styles, `@page` CSS, `LeadSection` + `PortfolioTable`) — but now from real data.

### Tests

- `lead-form.test.ts` — 17 cases (17 tests pass): `mapLeadProducts` stage-grid synthesis, `mapLeadItems` filter + projectName lookup + Unknown fallback, `mapLeadRisks` text composition, `mapLeadDecisions` department default, `mapLeadPriorities` rank clamp, `mapLeadPeriods` isCurrent/isSubmitted derivation, `mapLeadVersions` relative timestamp, `mapLeadFormData` empty / submitted / readOnly cases.
- `weekly-report.test.ts` — 9 cases (9 tests pass): `formatWeekRange` same-month + cross-month, `trafficToProductStatus` enum, `statusLabelFor` join, `mapWeeklyReport` empty / multi-lead grouping / blocked-severity inference / needsAttention escalation / decisions+priorities to first project / period info preservation.

Total new tests: **26**. Cumulative web vitest pass rate after this plan: **99 / 99**.

## Schemas used

| API call           | Zod schema                                                                                                      | Notes                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `reports.getActive`  | `reportSectionReadModelSchema \| null`                                                                            | Returns ONE section (the user's active section) — not a wider envelope. `currentUserId` = `section.authorId`. |
| `leadForm.byPeriod`  | input: `{ reportId: uuid }`; output: `{ section: ReportSectionReadModel; readOnly: boolean }`                     | Returns ONE section, not aggregated lead-form data. The plan's `<interfaces>` block was wrong (Rule 2 deviation).         |
| `leadForm.versions`  | input: **`{ reportSectionId: uuid }`** (NOT `sectionId`); output: `versionSnapshotSchema[]`                     | Plan said `{ sectionId }`; actual key is `reportSectionId`. Adjusted at call site.                                         |
| `reports.myHistory`  | `myHistoryEntrySchema[]` (no input)                                                                             | Reused from 21-02. Period dropdown derives `weekLabel`/`dateRange` from `periodStart`/`periodEnd`.                        |
| `weeklyReport.get`   | input: `z.object({ reportId: uuid().optional() }).optional()`; output: `weeklyReportReadModelSchema`            | Accepts `{}` for active-period fallback and `{ reportId }` for scoped reads. Per-page choice documented below.            |

## `weeklyReport.get` input — `period` vs `reportId`

`weeklyReport.get` does NOT take a `period` filter at v5.0. Behaviour by route:

- `/head/report?period=...` → `WeeklyReportPage` ignores the `period` hint and queries `weeklyReport.get({})`. Server resolves the active period via session. The `period` prop is preserved on the component signature for forward-compat (a future plan may add a period filter to the endpoint or re-route to `/reports/[reportId]`).
- `/reports/[reportId]/page.tsx` → `WeeklyReportPage` calls `weeklyReport.get({ reportId })` for the scoped view.
- `/reports/[reportId]/print/page.tsx` → calls `weeklyReport.get({ reportId })` directly (the print page does not reuse `WeeklyReportPage`'s shell — it owns A4-optimized JSX).

## Next.js 16 dynamic-param API

`reports/[reportId]/page.tsx` and `reports/[reportId]/print/page.tsx` now use the Next.js 16 client-side convention:

```ts
import { use } from 'react';

type Props = { params: Promise<{ reportId: string }> };

export default function PublishedReportPage({ params }: Props) {
  const { reportId } = use(params);
  // ...
}
```

The `params` prop is a `Promise` in Next.js 16; `use(params)` unwraps it synchronously inside a client component. The previous `await params` form (server component) is no longer applicable since both pages are now `'use client'`.

## Deviations from Plan

### [Rule 2 - Missing critical functionality] `leadForm.byPeriod` schema mismatch

**Found during:** Task 1 (mapper authoring)
**Issue:** Plan's `<interfaces>` block claims `leadForm.byPeriod` returns `{ products, currentWeek, nextWeek, risks, decisions, priorities }`. The actual service (`lead-form.service.ts -> getByPeriod`) returns `{ section: ReportSectionReadModel; readOnly: boolean }` — ONE section.
**Fix:** `mapLeadFormData` accepts `byPeriod: { section, readOnly }` and derives all six slices from `section.projects` / `section.items` / `section.risks` / `section.decisions` / `section.priorities`.
**Files modified:** `apps/web/src/lib/mappers/lead-form.ts` (Task 1, commit `70b6f0a`).

### [Rule 2] `leadForm.versions` input key mismatch

**Found during:** Task 2
**Issue:** Plan says `trpc.leadForm.versions.queryOptions({ sectionId })`. Actual schema is `z.object({ reportSectionId: z.string().uuid() })`.
**Fix:** Use the right key at the call site — `{ reportSectionId: activeSectionId }`.
**Files modified:** `apps/web/src/components/lead/lead-form.tsx` (Task 2, commit `c73043e`).

### [Rule 2] `reports.getActive` returns full section, not envelope

**Found during:** Task 1
**Issue:** Plan claims `reports.getActive` returns `{ reportId, sectionId, sectionStatus, ... }`. Actual return is `ReportSectionReadModel | null` — the section itself.
**Fix:** `mapLeadFormData` reads `active.reportId` / `active.reportSectionId` / `active.authorName` / `active.authorId` directly from the section. `null` case is handled by the page (`!activeQ.data` triggers skeleton).
**Files modified:** `apps/web/src/lib/mappers/lead-form.ts`, `apps/web/src/components/lead/lead-form.tsx`.

### [Rule 2] `MockProduct.stages` synthesized empty 7-grid

**Found during:** Task 1 (Same pattern as 21-03's admin synthesis.)
**Issue:** `ReportSectionReadModel.projects` only carries `{ projectId, projectName, trafficLight }` — no per-stage assignments.
**Fix:** Synthesize a 7-stage grid `[Planning, Analysis, Design, Dev, Testing, DevOps, Support]`. The "Dev" stage is auto-marked `ownership: 'mine'` with the section's `authorName` as assignee, status mapped from the project's `trafficLight`. All other stages are `empty / unassigned`. Phase 22 wires real per-stage assignments via `admin.listStageAssignments`.
**Stub tracked under "Known Stubs" below.**

### [Rule 2] `KanbanItem.stageName` not on `itemInputSchema`

**Found during:** Task 1
**Issue:** Mock `KanbanItem.stageName?: string` was a UI affordance. The schema only has `{ projectId, type, text, tag, workflowStatus }`.
**Fix:** `mapLeadItems` leaves `stageName` undefined; `CurrentWeekSection` / `NextWeekSection` group by product name only when `stageName` is absent (existing behavior preserved).

### [Rule 2] `RiskEntry.severity` / `.stageName` not on `riskInputSchema`

**Found during:** Task 1 / Task 1 weekly-report mapper
**Issue:** Mock `RiskEntry.severity` distinguishes 'at-risk' vs 'blocked'. Schema only has `{ projectId, risk, impact, mitigation }`.
**Fix:**
  - In `mapLeadRisks` (lead form), severity defaults to `'at-risk'`. `stageName` defaults to "—". Text is composed as `${risk} — Impact: ${impact} — Mitigation: ${mitigation}`.
  - In `mapWeeklyReport`, severity is INFERRED: if any item in the same project has `workflowStatus === 'blocked'`, the project's risks are flagged 'blocked'. Otherwise 'at-risk'. This matches the heuristic the mock data used.

### [Rule 2] `DecisionEntry.productId` / `.productName` not on `decisionInputSchema`

**Found during:** Task 1
**Issue:** Mock decisions have `productId` + `productName`. Schema decisions are department-scoped (`{ text, owner, deadline?, impact, resolvedAt? }`).
**Fix:**
  - In `mapLeadDecisions`, `productId = ''` and `productName = 'Department'`. The lead UI renders decisions in a flat list (productName isn't currently shown).
  - In `mapWeeklyReport`, decisions attach to the section author's first project (so the per-product accordion renders them under the lead's primary product). Sections with no projects drop their decisions.

### [Rule 2] `VersionSnapshot` aggregates not stored

**Found during:** Task 1
**Issue:** Mock `VersionSnapshot` carries `itemCount` / `riskCount` / `decisionCount`. Schema `versionSnapshotSchema` is `{ id, reportSectionId, version, createdAt }` — no aggregates.
**Fix:** `mapLeadVersions` defaults all counts to 0; `timestamp` is formatted via a relative-time helper. The version dropdown still renders correctly; counts will need a per-version diff endpoint or stored aggregates.
**Stub tracked under "Known Stubs" below.**

### [Rule 2] Print page: server -> client refactor

**Found during:** Task 3
**Issue:** Plan asks the print page to be `'use client';`. The original was a server component reading from mock-data; converting to a client component lets it fetch via `weeklyReport.get` directly without an API roundtrip in a server-component data layer (which is owned by Phase 23 / PDF orchestration).
**Trade-off:** The print template no longer streams from the server, but the existing `@media print` CSS + inline styles still produce a correct A4 layout when the user prints from a browser. Phase 23 will introduce a server-rendered PDF pipeline (Playwright) that loads this page in a headless browser.
**Files modified:** `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx`.

### [Rule 3] `period` prop preserved on `WeeklyReportPage` despite no API support

**Found during:** Task 3
**Issue:** `(app)/head/report/page.tsx` already passes `period` (string from `searchParams`) to `WeeklyReportPage`. The endpoint `weeklyReport.get` does NOT accept a `period` filter at v5.0.
**Fix:** Component signature preserved (`{ period?: string; reportId?: string }`); `period` is unused at runtime (consumed-but-ignored, marked `_period`). Documented in the JSDoc that `period` is forward-compat only. When the endpoint gains a period filter (or admin period read model is wired), this prop will become a real query input.

### KPI counts re-derived for print page

**Found during:** Task 3 final verification
**Issue:** Print page previously rendered `MOCK_KPI.blockedCount` / `atRiskCount` / `decisionCount`. Removing the mock import meant we needed equivalent counts.
**Fix:** Counts derived from the per-product `products` array: `blockedCount` = products where `status === 'blocked'`; `atRiskCount` = products where `status === 'at-risk'`; `decisionCount` = sum of `decisions.length` across all products. Submitted/total come straight from `weeklyReport.submissionCount` / `.totalLeads`.

## TODO(Phase 22) markers added

| File                                                          | Count | Sites                                                                                                                                                                                |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/components/lead/lead-form.tsx`                  | **8** | `handleSubmit`, `handleConfirmSubmit`, FillFromButton onFillFrom, VersionHistoryNav onRestore, SDLC pipeline saveDraft, Risks saveDraft, Decisions saveDraft, Priorities saveDraft   |
| `apps/web/src/components/weekly-report/weekly-report-page.tsx`| **2** | `ExportPdfButton onExport` (`pdfExport.request`), `PublishLockButton onPublish` (`period.publish`)                                                                                   |
| `apps/web/src/app/(app)/reports/[reportId]/page.tsx`          | 0     | (pure routing wrapper; no mutations)                                                                                                                                                 |
| `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx`    | 0     | (pure render; no interactive controls)                                                                                                                                               |

Total: **10 markers** across 2 files. Phase 22 planner uses this to scope mutation tasks.

## Mock-data.ts cleanup readiness

After this plan:

- `apps/web/src/components/lead/mock-data.ts` — still imported as TYPE-ONLY by `sdlc-pipeline.tsx`, `current-week-section.tsx`, `next-week-section.tsx`, `risks-section.tsx`, `decisions-section.tsx`, `priorities-section.tsx`, `period-navigator.tsx`, `fill-from-button.tsx`, `version-history-nav.tsx`, `lead-form.tsx`. **No value imports remain.** Safe to delete in Phase 22 cleanup if the type definitions move into `apps/web/src/lib/mappers/lead-form.ts` (which already re-declares them — just need to swap the type-only imports across children).

- `apps/web/src/components/dashboard/mock-data.ts` — still imported as TYPE-ONLY by `weekly-report-page.tsx`, `portfolio-overview-table.tsx`, `product-accordion.tsx`, `period-navigator.tsx (weekly-report)`, `print/page.tsx`, `[reportId]/page.tsx`, plus dashboard children. **No value imports remain anywhere.** Safe to delete in Phase 22 once children migrate to typed imports from `apps/web/src/lib/mappers`.

- `apps/web/src/components/admin/mock-data.ts` — same status as 21-03 reported.

The Phase 22 cleanup will: (a) move all the presentation type aliases out of `mock-data.ts` files into the mapper barrels, (b) update children to import types from `'../../lib/mappers'`, (c) delete the four `mock-data.ts` files.

## Verification

| Check                                                                                | Result                                       |
| ------------------------------------------------------------------------------------ | -------------------------------------------- |
| `pnpm --filter @customreport/web typecheck`                                          | passes                                       |
| `pnpm --filter @customreport/web vitest run`                                         | **99 / 99 tests pass** (+26 new)             |
| `pnpm --filter @customreport/web build`                                              | passes                                       |
| Cross-plan grep: `import\s*\{[^}]*\bMOCK_[A-Z_]+\b` under `apps/web/src/{app,components}` | **no matches** (no value imports of `MOCK_*` anywhere) |

## Commits

- `70b6f0a` — feat(21-04): lead-form + weekly-report composite mappers with tests
- `c73043e` — feat(21-04): migrate Lead Form to four useQuery calls + skeleton + toast
- `734b057` — feat(21-04): migrate Weekly Report + reports/[reportId] pages to weeklyReport.get

## Known Stubs

The following are intentional Phase-21-scoped stubs that will be wired up in subsequent plans/phases. Each is annotated in source with a comment.

- **`MockProduct.stages` (Lead Form):** Synthesized 7-stage grid with the section author auto-assigned to "Dev". Real per-stage assignments come from `admin.listStageAssignments({ projectId })` — Phase 22.
- **`KanbanItem.stageName`:** Always `undefined` (item schema has no stage field). UI groups by product name only.
- **`RiskEntry.severity` (Lead Form):** Always `'at-risk'`. Schema lacks severity. Phase 22 may extend the schema or surface severity via item workflowStatus correlation.
- **`RiskEntry.stageName`:** "—". Schema lacks stage.
- **`DecisionEntry.productId/productName` (Lead Form):** `'' / 'Department'`. Decisions are department-scoped at v5.0.
- **`VersionSnapshot.itemCount / riskCount / decisionCount`:** All 0. Aggregates not stored on the snapshot row; would require a per-version diff endpoint.
- **`WeeklyReportPage.period` prop:** Forward-compat only — `weeklyReport.get` accepts no period filter. The active-period default applies.
- **All Lead Form mutation handlers:** `handleSubmit`, `handleConfirmSubmit`, fill-from, restore-version, all `saveDraft` triggers from section components remain LOCAL state updates — no server mutations until Phase 22.
- **`ExportPdfButton` / `PublishLockButton`:** Not wired to mutations. Phase 22 (publish) and Phase 23 (PDF) will own them.
- **Risk severity inference (Weekly Report):** Severity inferred via blocked-item proximity. May misclassify if a project has both blocked items and at-risk-only risks. Acceptable until severity becomes a first-class field.
- **Decisions/priorities attribution (Weekly Report):** Attached to each section's first project. Sections with no projects drop their decisions/priorities. A section author with multiple projects sees all their decisions under their primary project — minor distortion of mock semantics, acceptable for read-only display.

These stubs do not block Phase 21's read-path goal. Phase 22 (mutations) and Phase 23 (PDF) will resolve them.

## E2E impact

E2E specs were not run as part of this plan (consistent with 21-02 / 21-03). The migrated UI continues to render the same JSX structure with the same prop types, so visual specs should remain stable when the backend seed produces realistic data. PITFALLS Pitfall 4 (E2E test breakage from real-API integration) remains the same gate as previous plans — owned by Phase 26.

## Self-Check

- File `apps/web/src/lib/mappers/lead-form.ts`: FOUND
- File `apps/web/src/lib/mappers/lead-form.test.ts`: FOUND
- File `apps/web/src/lib/mappers/weekly-report.ts`: FOUND
- File `apps/web/src/lib/mappers/weekly-report.test.ts`: FOUND
- File `apps/web/src/components/lead/lead-form-skeleton.tsx`: FOUND
- File `apps/web/src/components/weekly-report/weekly-report-skeleton.tsx`: FOUND
- File `apps/web/src/components/lead/lead-form.tsx`: FOUND (modified)
- File `apps/web/src/components/weekly-report/weekly-report-page.tsx`: FOUND (modified)
- File `apps/web/src/app/(app)/reports/[reportId]/page.tsx`: FOUND (modified)
- File `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx`: FOUND (modified)
- Commit `70b6f0a`: FOUND
- Commit `c73043e`: FOUND
- Commit `734b057`: FOUND

## Self-Check: PASSED
