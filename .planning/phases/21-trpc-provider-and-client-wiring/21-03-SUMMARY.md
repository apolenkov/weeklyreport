---
plan: 21-03
phase: 21-trpc-provider-and-client-wiring
status: complete
completed: 2026-04-25
subsystem: web/admin + web/dashboard
requirements: [TRPC-04, TRPC-05, TRPC-06]
tech-stack:
  patterns:
    - Container lifts useQuery, passes mock-shaped slices to presentational tabs
    - Composite mappers in apps/web/src/lib/mappers (Zod -> mock-shaped types)
    - useEffect re-seeds local CRUD state when query revalidates
    - TODO(Phase 22) markers at every mutation site for staged hand-off
key-files:
  created:
    - apps/web/src/lib/mappers/admin.ts
    - apps/web/src/lib/mappers/admin.test.ts
    - apps/web/src/lib/mappers/dashboard.ts
    - apps/web/src/lib/mappers/dashboard.test.ts
    - apps/web/src/components/admin/admin-skeleton.tsx
    - apps/web/src/components/dashboard/dashboard-skeleton.tsx
  modified:
    - apps/web/src/lib/mappers/index.ts
    - apps/web/src/components/admin/admin-panel.tsx
    - apps/web/src/components/admin/users-tab.tsx
    - apps/web/src/components/admin/products-tab.tsx
    - apps/web/src/components/admin/periods-tab.tsx
    - apps/web/src/components/admin/reminders-tab.tsx
    - apps/web/src/components/admin/settings-tab.tsx
    - apps/web/src/components/admin/stage-assignment-editor.tsx
    - apps/web/src/components/dashboard/dashboard-page.tsx
metrics:
  tasks: 3
  commits: 3
  duration: ~1h
---

# Plan 21-03: Admin Panel + Dashboard Migration — SUMMARY

## One-liner

Admin Panel (5 tabs) and head Dashboard now read live data from `admin.snapshot` + `admin.getSettings` + `review.dashboard` + `archive.list` + `weeklyReport.get` via composite mappers; mutations remain local-state with TODO(Phase 22) markers.

## What was built

### Composite mappers

- `mapAdminSnapshot(api: AdminSnapshot)` — translates the single admin snapshot into 4 mock-shaped slices (`users`, `products`, `periods`, `reminders`).
- `mapAdminSettings(api: AppSettings)` — 1:1 passthrough into `MockSettings`.
- `mapDashboardData({ review, archive, weeklyReport, now?, currentUserId? })` — composes 3 endpoints into `{ kpi, leads, blockedAtRisk, archive, pendingLeads }`.
- `formatRelativeDeadline(deadline, now)` exported helper for KPI deadline label.

### UI

- `AdminTabSkeleton` (`variant: 'table' | 'form'`) — matches final dimensions to prevent layout shift.
- `DashboardSkeleton` — KPI 3-up + alert bar + blocked table + leads grid + archive 4-up.
- `AdminPanel` lifts both queries (`admin.snapshot`, `admin.getSettings`) and dispatches mock-shaped slices to each tab.
- 5 tabs (`UsersTab`, `ProductsTab`, `PeriodsTab`, `RemindersTab`, `SettingsTab`) accept `initial*` props, seed local state via `useState`, re-seed via `useEffect` on prop change.
- Every mutation call site carries a `TODO(Phase 22)` comment naming the future tRPC mutation.
- `DashboardPage` composes `review.dashboard`, `archive.list({ limit: 12 })`, `weeklyReport.get({})` with three `useQuery` calls + three `useEffect` toast handlers + skeleton fallback.

### Tests

- `admin.test.ts` — 11 cases (11 tests pass): empty snapshot, role passthrough, archived flag, 7-stage grid synthesis, period status mapping, weekLabel/date synthesis, reminder active/paused, reminder name synthesis, ID/email preservation, settings 2 round-trips.
- `dashboard.test.ts` — 12 cases (12 tests pass): deadline 'Past' / hours / days, kpi.submitted, deadlineLabel format, blockedCount/atRiskCount, decisionCount, lead status derivation across 3 leads, pendingLeads list, blockedAtRisk severities, archive synthesis, isCurrentUser flag.
- All test fixtures built from `*Schema.parse(...)` so future schema drift surfaces in tests, not at runtime.

## Schemas used

| API call            | Zod schema                                                                                                    | Notes                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `admin.snapshot`    | `adminSnapshotSchema`                                                                                         | `{ users, projects, periods, reminderRules, reminderExecutions }` — does NOT include stages/stageAssignments |
| `admin.getSettings` | `appSettingsSchema`                                                                                           | exact 1:1 with `MockSettings`                                                                                |
| `review.dashboard`  | `submissionDashboardRowSchema[]`                                                                              | row-only — no aggregate KPI fields                                                                           |
| `archive.list`      | `paginationInputSchema` (input) -> `PaginatedResult<ArchiveReportSummary>`                                    | passed `{ limit: 12 }`                                                                                       |
| `weeklyReport.get`  | input `z.object({ reportId: z.string().uuid().optional() }).optional()`; output `weeklyReportReadModelSchema` | called with `{}` to use server-side active-report fallback                                                   |

## Deviations from Plan

### [Rule 2 - Missing critical functionality] `admin.snapshot` shape mismatch

**Found during:** Task 1 (mapper authoring)
**Issue:** Plan's must_haves and `<interfaces>` claim `admin.snapshot` returns `stages` and `stageAssignments`. The actual schema (`adminSnapshotSchema` in `packages/shared/src/schemas/report.ts`) only has `{ users, projects, periods, reminderRules, reminderExecutions }`.
**Fix:** `mapAdminSnapshot` no longer claims to return stages/stageAssignments. Each product gets a synthesized 7-stage empty grid (`assigneeId: null`) so `ProductsTab` still renders. Phase 22 will fetch real assignments per product via `admin.listStageAssignments({ projectId })`.
**Files modified:** `apps/web/src/lib/mappers/admin.ts` (Task 1 commit `2f50290`).
**Out-of-scope items deferred:** real stage assignments → Phase 22.

### [Rule 2] `review.dashboard` is row-only — KPI must come from `weeklyReport`

**Found during:** Task 1 (mapper authoring)
**Issue:** Plan's `<behavior>` for `mapDashboardData` assumes `review.dashboard` carries `submittedCount`, `totalLeads`, `avgCompletionPct`, `periodDeadline`, `escalations`. None of these exist; it is `SubmissionDashboardRow[]` only.
**Fix:** KPIs sourced from `weeklyReport.get`:

- `kpi.submitted` ← `weeklyReport.submissionCount`
- `kpi.total` ← `weeklyReport.totalLeads`
- `kpi.blockedCount` / `kpi.atRiskCount` ← `weeklyReport.escalations` filtered by `type`
- `kpi.decisionCount` ← sum of `decisions.length` across `weeklyReport.leadSections`
- `blockedAtRisk` ← `weeklyReport.escalations` (mapping `unresolved_risk` → `at-risk`)
- lead status ← `review.dashboard` row + matching section in `weeklyReport.leadSections` (via `deriveLeadStatus`).
  **Files modified:** `apps/web/src/lib/mappers/dashboard.ts` (Task 1 commit `2f50290`).

### [Rule 2] Deadline field absent from read models

**Found during:** Task 1
**Issue:** Neither `weeklyReportReadModelSchema` nor `submissionDashboardRowSchema` exposes a `deadline`. The mock UI rendered "2d 5h" + "Friday 18:00".
**Fix:** Use `weeklyReport.periodEnd` as a proxy for the deadline. `kpi.deadlineLabel` is computed via `formatRelativeDeadline(periodEnd, now)`. `kpi.deadlineTime` falls back to the ISO date string of `periodEnd`. Real deadline lives on `reportPeriodSchema` (admin endpoint) but isn't surfaced to leads/dashboard at v5.0.
**Files modified:** `apps/web/src/lib/mappers/dashboard.ts`.

### [Rule 2] No "last week" comparison endpoint

**Found during:** Task 1
**Issue:** Mock KPI carries `lastWeekSubmitted` / `lastWeekTotal`. No corresponding API in v5.0.
**Fix:** Default to `0/0`. `KpiCards` renders "Last week: 0/0" until a comparison endpoint exists.

### [Rule 2] `archive.list` summary is leaner than the mock entry

**Found during:** Task 1
**Issue:** `ArchiveReportSummary` lacks `weekLabel`, `dateRange`, `submissionLabel`, `productCount`, `riskCount`, `decisionCount`.
**Fix:** Synthesize `weekLabel` from `periodStart` (ISO week number) and `dateRange` as `"Apr 6–Apr 12"`-style label. Defaults: `submissionLabel = ""`, counts = `0`. Status forced to `'published'` (the only state archived reports are in). The dashboard archive grid still renders, but the per-card metadata strip is light. A real archive-with-counts endpoint can be added in a future plan.

### [Rule 2] `adminUserSchema` lacks `department`

**Found during:** Task 1
**Issue:** Mock `MockUser.department` is required.
**Fix:** Default to `'CoreDev'` in `mapUser`. Phase 22 will need a schema extension if departments become real.

### [Rule 2] `reportPeriodSchema.status` is `'draft' | 'published'` (no `'reopened'`)

**Found during:** Task 1
**Issue:** Mock UI knows three states.
**Fix:** Map `'draft' → 'open'`. `'reopened'` is unreachable from `admin.snapshot`; `periodReadModelSchema` exposes a richer `periodStatus` but is not in this snapshot. Acceptable until Phase 22 bumps the snapshot shape.

### [Rule 2] `adminReminderRuleSchema` has no name/description

**Found during:** Task 1
**Issue:** Mock `MockReminder.name` and `description` rendered in the UI.
**Fix:** Synthesize: `name` from `kind` (`'Deadline reminder'` / `'Follow-up reminder'`), `description` from `kind` + `fireAt`. `mock.active = api.status === 'active'` (per PITFALLS Pitfall 1).

### [Rule 3] Path alias `@/...` not configured

**Found during:** Task 2 typecheck
**Issue:** Used `@/lib/...` import in `admin-panel.tsx`; web's tsconfig has no `@/` baseUrl alias (only `@customreport/*` workspace aliases).
**Fix:** Switched to relative imports (`../../lib/trpc-context`, `../../lib/mappers`).

### [Rule 3] `StageAssignmentEditor` value-imported `getLeadUsers`

**Found during:** Task 2
**Issue:** Tab needed `MOCK_USERS` removed but `StageAssignmentEditor` still pulled `getLeadUsers()` from `mock-data` (a value import). Plan only listed admin-tab files in scope, but the import lived in a sibling editor component used by ProductsTab.
**Fix:** Refactored `StageAssignmentEditor` to accept `leads: MockUser[]` as a prop. ProductsTab now derives `leads` from its `initialUsers` prop and passes it down. Type-only import of `MockUser` retained.

## `weeklyReport.get` input

Called with `{}` (empty object) to use the server-side active-report fallback in `WeeklyReportService.getWeeklyReport()`. When no active report exists, the service throws `WeeklyReportDomainError`, surfaced as `weeklyQ.isError` → toast.

## Skeleton ↔ data alignment

- `AdminTabSkeleton variant='table'` matches the 5-column table layout used by Users / Periods / Products / Reminders.
- `AdminTabSkeleton variant='form'` matches Settings' 4 stacked label+input groups.
- `DashboardSkeleton` mirrors the 5-section dashboard shell (KPI 3-up, alert bar, blocked table, leads grid, archive grid).

## Verification

| Check                                                 | Result                                           |
| ----------------------------------------------------- | ------------------------------------------------ |
| `pnpm --filter @customreport/web typecheck`           | passes                                           |
| `pnpm --filter @customreport/web vitest run`          | 73 / 73 tests pass (11 admin + 12 dashboard new) |
| `pnpm --filter @customreport/web build`               | passes                                           |
| Admin tab MOCK\_\* value-import grep                  | clean                                            |
| Dashboard MOCK\_\* references + required strings grep | clean                                            |

## Commits

- `2f50290` — feat(21-03): admin + dashboard composite mappers with tests
- `b09db4f` — feat(21-03): migrate Admin Panel tabs to admin.snapshot + admin.getSettings
- `a376675` — feat(21-03): migrate Dashboard page to review.dashboard + archive.list + weeklyReport.get

## Known Stubs

The following are intentional Phase-21-scoped stubs that will be wired up in subsequent plans/phases. Each is annotated in source with a TODO marker:

- **`MockProduct.stages`**: synthesized empty 7-stage grid (per product). `StageAssignmentEditor` renders selects with `value=""` (Unassigned). Wiring to `admin.listStageAssignments` deferred to Phase 22.
- **`MockUser.department`**: hard-coded `'CoreDev'`. Schema extension required before this becomes dynamic.
- **`MockReminder.name` / `description`**: synthesized labels. Real names live in user-editable rules; out of scope for v5.0 read path.
- **`KpiData.lastWeekSubmitted` / `lastWeekTotal`**: 0/0 — no comparison endpoint exists.
- **`ArchiveReport.submissionLabel` / `productCount` / `riskCount` / `decisionCount`**: 0 / "" — `ArchiveReportSummary` does not carry these aggregates.
- **`ArchiveReport.status`**: forced to `'published'` until a multi-status archive read model exists.
- **All admin tab `setState` calls**: marked `TODO(Phase 22)` to be replaced with mutation `onSuccess` + `invalidateAdmin(qc, trpc)`.
- **`SettingsTab` save flash**: also marked `TODO(Phase 22)` — currently a 2s green-check timeout, not an actual mutation.

These do not block Phase 21's goal (read-path migration). Phase 22 (mutations) and a future "richer read models" plan will resolve them in order.

## E2E impact

E2E specs were not run as part of this plan (the plan's verification block flagged them as pre-existing seed-dependent suites). The migrated UI continues to render the same JSX structure with the same prop types, so visual specs should remain stable when the backend seed produces realistic data.

## Self-Check

- File `apps/web/src/lib/mappers/admin.ts`: FOUND
- File `apps/web/src/lib/mappers/admin.test.ts`: FOUND
- File `apps/web/src/lib/mappers/dashboard.ts`: FOUND
- File `apps/web/src/lib/mappers/dashboard.test.ts`: FOUND
- File `apps/web/src/components/admin/admin-skeleton.tsx`: FOUND
- File `apps/web/src/components/dashboard/dashboard-skeleton.tsx`: FOUND
- File `apps/web/src/components/admin/admin-panel.tsx`: FOUND (modified)
- File `apps/web/src/components/dashboard/dashboard-page.tsx`: FOUND (modified)
- Commit `2f50290`: FOUND
- Commit `b09db4f`: FOUND
- Commit `a376675`: FOUND

## Self-Check: PASSED
