---
phase: 22-interactivity-status-risk-sync
plan: 05
subsystem: ui
tags: [trpc, react-query, mutation, cache-invalidation, weekly-report, publish, reopen]

# Dependency graph
requires:
  - phase: 21-trpc-readpath-migration
    provides: TRPCProvider, useTRPC(), invalidateDashboard / invalidateLeadForm / invalidateLeadHistory helpers, weeklyReport.get → mapWeeklyReport mapper, parent container pattern
provides:
  - Head's Publish & Lock action wired to period.publish via real tRPC mutation with cache cascade
  - Head's Reopen Period action wired to period.reopen with broader cascade (dashboard + leadForm + leadHistory)
  - PublishLockButton refactored to a parent-controlled prop API (onPublish/onReopen/periodStatus/isPending); removes internal isPublished state
  - mapWeeklyReport additively surfaces period.reportId + period.periodStatus on the period object
  - ExportPdfButton deferred cleanly to Phase 23 with a toast.info on click + TODO(Phase 23) marker
  - Cache-keys cascade verified by a unit test asserting invalidateDashboard / LeadForm / LeadHistory / Admin route to the right pathFilters
affects: [phase-23-pdf-jobs, phase-24-auth-guards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parent-owned mutation pattern: child UI components receive `on*` callbacks and `isPending`; parent owns useMutation + cache invalidation"
    - "Mutation onSuccess cascade: invalidate the union of query namespaces touched by the server-side state change (publish → dashboard + leadHistory; reopen → dashboard + leadForm + leadHistory)"
    - "Mock-trpc-proxy testing: stub the tRPC proxy (queryOptions/mutationOptions/pathFilter) instead of extending MSW handlers — keeps mutation wiring tests fast and deterministic"

key-files:
  created:
    - apps/web/src/components/weekly-report/publish-lock-button.test.tsx
    - apps/web/src/components/weekly-report/weekly-report-page.test.tsx
    - apps/web/src/lib/cache-keys.test.ts
  modified:
    - apps/web/src/components/weekly-report/weekly-report-page.tsx
    - apps/web/src/components/weekly-report/publish-lock-button.tsx
    - apps/web/src/components/weekly-report/export-pdf-button.tsx
    - apps/web/src/lib/mappers/weekly-report.ts
    - apps/web/src/lib/mappers/weekly-report.test.ts

key-decisions:
  - "Mapper change is additive: period gets reportId + periodStatus alongside the existing period.id (= reportId) and the top-level periodStatus. Pure addition keeps Phase 21 mapper consumers and tests unaffected."
  - "PublishLockButton drops local isPublished state. Source of truth is the periodStatus prop fed by the page-level useQuery → invalidateDashboard cycle. The dialog still always opens; only the confirm handler now calls the parent's onPublish."
  - "ExportPdfButton stays visible (head sees the affordance) and surfaces toast.info on click. Disabling would lose discoverability; the toast both signals 'not yet' and acts as a feature-coming-soon hint."
  - "Cache cascade is asymmetric: publish invalidates dashboard + leadHistory (lead forms are already submitted+locked, no need to refetch them); reopen invalidates dashboard + leadForm + leadHistory because lead forms become editable again."

patterns-established:
  - "Parent-owned mutation: child component is dumb (controlled), parent wires useMutation(trpc.x.y.mutationOptions({ onSuccess, onError })) and passes onPublish/onReopen/isPending"
  - "TanStack Query mutationFn assertion shape: assert mock.calls[0][0] (variables) directly — TanStack Query also passes a context arg, so toHaveBeenCalledWith(variables) without exact-match flexibility fails"
  - "tRPC stub for component tests: build a typed-as-never proxy where queryOptions returns { queryKey, queryFn }, mutationOptions captures the options bag and returns { mutationFn, onSuccess, onError }, and pathFilter returns a tagged object for cache invalidation assertions"

requirements-completed: [INT-02]

# Metrics
duration: ~30min
completed: 2026-04-25
---

# Phase 22 Plan 05: Wire Publish & Lock + Reopen mutations on Weekly Report

**Head can now publish, lock, and reopen periods through real tRPC mutations with full cache cascade across dashboard, lead forms, and lead history; Export PDF cleanly deferred to Phase 23.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-25T20:11:00Z
- **Completed:** 2026-04-25T20:20:44Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 5 (3 new tests, 2 component refactors, 1 PDF stub, 1 mapper extension)

## Accomplishments

- INT-02 closed: Publish & Lock + Reopen wired to real `period.publish` / `period.reopen` mutations
- Cache-invalidation cascade unit-tested independent of UI; UI tests further verify the chain end-to-end
- Phase 22 TODO markers fully cleared from weekly-report-page.tsx (0 remaining)
- ExportPdfButton converted from a fake-timer stub into an explicit "ships in v5.0 Phase 23" surface stub
- PublishLockButton API now parent-controlled — eliminates internal state divergence from server reality

## Task Commits

1. **Task 1 RED — failing tests for publish/reopen wiring** — `6cb870f` (test)
2. **Task 1 GREEN — wire period.publish + period.reopen** — `3cd865b` (feat)
3. **Task 2 — defer Export PDF + cache cascade test** — `eceec9c` (feat)

## Files Created/Modified

### Created

- `apps/web/src/components/weekly-report/publish-lock-button.test.tsx` — 8 RTL scenarios covering periodStatus-driven label, confirmation gate (always open + cancel-no-op), pending-leads warning copy, reopen click direct path, and isPending-disabled state.
- `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` — 5 wiring scenarios using a mocked tRPC proxy + QueryClient: publish click fires mutation with reportId, onSuccess fires invalidateDashboard + invalidateLeadHistory + toast.success, onError fires toast.error, reopen click fires period.reopen, reopen onSuccess fires the broader cascade.
- `apps/web/src/lib/cache-keys.test.ts` — Asserts invalidateDashboard / LeadForm / LeadHistory / Admin invoke `qc.invalidateQueries` with the expected pathFilters (verified via spy).

### Modified

- `apps/web/src/components/weekly-report/weekly-report-page.tsx` — Imports useMutation/useQueryClient + invalidate* helpers; constructs publishMut + reopenMut with onSuccess cascade and onError toast; passes onPublish/onReopen/periodStatus/isPending to PublishLockButton; rewrites the ExportPdfButton TODO from Phase 22 → Phase 23.
- `apps/web/src/components/weekly-report/publish-lock-button.tsx` — Removes useState(isPublished); adds onPublish, onReopen, periodStatus, isPending props; renders Reopen Period button when periodStatus === 'published', otherwise Publish & Lock with confirmation dialog. Cancel never invokes a callback.
- `apps/web/src/components/weekly-report/export-pdf-button.tsx` — Replaces setTimeout-based fake export with toast.info('PDF export will be available in v5.0 Phase 23'); adds title attr + TODO(Phase 23) docblock.
- `apps/web/src/lib/mappers/weekly-report.ts` — Additively surfaces `period.reportId` and `period.periodStatus`; keeps `period.id` (= reportId) and top-level `periodStatus` for backwards compatibility with Phase 21 consumers.
- `apps/web/src/lib/mappers/weekly-report.test.ts` — Three new cases asserting reportId + periodStatus on the period object across open / published / reopened.

## Decisions Made

See key-decisions in frontmatter. Notable: the mapper change is purely additive (no breakage), the dashboard cross-check confirmed `dashboard-page.tsx` already consumes `review.dashboard`, `archive.list`, and `weeklyReport.get` via useQuery (Phase 21 work), so no changes were needed there for the cascade to flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] TanStack Query mutationFn invocation passes a 2-arg signature (variables, context); test assertions using `toHaveBeenCalledWith(variables)` fail.**

- **Found during:** Task 1 GREEN verification.
- **Issue:** TanStack Query's internal mutate path passes a context object as the second positional argument to mutationFn. `toHaveBeenCalledWith({ reportId })` does not match because the mock receives 2 arguments.
- **Fix:** Assert against `mock.calls[0][0]` (the first positional arg) using `toEqual` instead of relying on full-arity equality.
- **Files modified:** apps/web/src/components/weekly-report/weekly-report-page.test.tsx
- **Verification:** vitest re-run, both publish + reopen mutation-fn assertions pass.
- **Committed in:** `3cd865b` (folded into the GREEN commit).

**2. [Rule 3 — Blocking issue] HeadPeriodNavigator (rendered by WeeklyReportPage) calls Next.js `useRouter()` and crashes in jsdom without an app router.**

- **Found during:** Task 1 RED → first vitest run.
- **Issue:** Rendering WeeklyReportPage in tests pulled in HeadPeriodNavigator → `next/navigation` `useRouter` → "invariant expected app router to be mounted".
- **Fix:** Added a `vi.mock('next/navigation', …)` block in weekly-report-page.test.tsx supplying stub useRouter / useSearchParams / usePathname (matching the pattern already used by period-navigator.test.tsx).
- **Files modified:** apps/web/src/components/weekly-report/weekly-report-page.test.tsx
- **Verification:** All 5 page-level scenarios pass.
- **Committed in:** `6cb870f` (folded into the RED commit).

**3. [Rule 3 — Blocking issue] `toBeInTheDocument` / `toBeDisabled` matchers not augmented at type level for new test files.**

- **Found during:** Task 1 GREEN typecheck.
- **Issue:** vitest.setup.ts imports `@testing-library/jest-dom/vitest` for runtime, but the type augmentation only applies to files that include the import directly under the project's tsconfig. Pre-existing `lead-form-sync-bridge.test.tsx` (added by a parallel plan) shows the same pattern.
- **Fix:** Added a per-file `import '@testing-library/jest-dom/vitest';` to publish-lock-button.test.tsx so its assertions type-check. weekly-report-page.test.tsx does not use jest-dom matchers and needed no change.
- **Files modified:** apps/web/src/components/weekly-report/publish-lock-button.test.tsx
- **Verification:** `tsc --noEmit` reports zero errors in the files owned by this plan.
- **Committed in:** `3cd865b`.

### Out-of-scope findings

The repo-wide `tsc --noEmit -p tsconfig.json` reports several pre-existing errors in files this plan does not own (admin/admin-panel.tsx, lead/lead-form-sync-bridge.test.tsx, lib/use-cursor-pagination.ts, etc.). Those originated in parallel plans (22-01..22-04) — out of scope for 22-05. Logged here for visibility; the plan's owned files type-check clean.

## Verification

### Plan acceptance criteria (Task 1)

| Check                                                                          | Expected | Result |
| ------------------------------------------------------------------------------ | -------- | ------ |
| `grep -F trpc.period.publish.mutationOptions` in weekly-report-page.tsx        | ≥ 1      | 1      |
| `grep -F trpc.period.reopen.mutationOptions` in weekly-report-page.tsx         | ≥ 1      | 1      |
| `grep -F invalidateLeadHistory` in weekly-report-page.tsx                      | ≥ 1      | 3      |
| `grep -E (onPublish|onReopen|periodStatus)\??:` in publish-lock-button.tsx     | ≥ 3      | 3      |
| `grep -E reportId\|periodStatus` in mappers/weekly-report.ts                   | ≥ 2      | 12     |
| No `TODO(Phase 22)` for PublishLockButton in weekly-report-page.tsx            | true     | true   |

### Plan acceptance criteria (Task 2)

| Check                                                                            | Expected | Result |
| -------------------------------------------------------------------------------- | -------- | ------ |
| Phase 23 markers across export-pdf-button.tsx + weekly-report-page.tsx           | ≥ 1      | 3      |
| `grep -c TODO(Phase 22)` in weekly-report-page.tsx                               | 0        | 0      |
| `grep -F trpc.review.dashboard` in dashboard-page.tsx                            | ≥ 1      | 1      |
| Integration smoke test exists at weekly-report-page.test.tsx                     | true     | true   |

### Test runs

- `pnpm exec vitest run src/components/weekly-report/ src/components/dashboard/ src/lib/cache-keys src/lib/mappers/weekly-report` — 35 tests, all green.
- Full web suite: `pnpm exec vitest run` — 153 tests across 20 files, all green.
- `pnpm exec tsc --noEmit -p tsconfig.json` — zero errors in this plan's files (weekly-report-*, mappers/weekly-report*, cache-keys*, export-pdf-button*).

## Self-Check

Verifying claims:

- `apps/web/src/components/weekly-report/publish-lock-button.test.tsx` — FOUND
- `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` — FOUND
- `apps/web/src/lib/cache-keys.test.ts` — FOUND
- Modified files (publish-lock-button.tsx, weekly-report-page.tsx, export-pdf-button.tsx, mappers/weekly-report.ts, mappers/weekly-report.test.ts) — all confirmed via `git diff` against pre-plan tree.
- Commits 6cb870f, 3cd865b, eceec9c — all present in `git log`.

## Self-Check: PASSED
