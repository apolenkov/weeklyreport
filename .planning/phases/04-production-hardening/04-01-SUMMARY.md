---
phase: 04-production-hardening
plan: 01
type: summary
status: done
---

# Plan 04-01 Summary: Hydration/SSR Stabilization

## What was done

Created `useBrowserState` hook and refactored all 6 browser-backed pages to eliminate SSR/client hydration mismatches.

### Task 1: Refactor browser-backed state hydration boundaries

**Created** `apps/web/src/lib/use-browser-state.ts` — SSR-safe hook that:
- Returns a deterministic `serverDefault` during SSR and first client render
- Syncs real browser value (localStorage/cookies) via `useEffect` post-mount
- Exposes `[state, setState]` tuple like `useState`

**Refactored 6 pages** to replace unsafe `useMemo`/`useState` initializers:

| Page | Browser state | Server default |
|------|--------------|----------------|
| `lead/report/page.tsx` | session + section | `defaultLeadSession` + `createDemoSection()` |
| `head/dashboard/page.tsx` | session + dashboard rows | `defaultLeadSession` + `buildSubmissionDashboardRows(null)` |
| `head/report/page.tsx` | session + assembled report | `defaultHeadSession` + `buildDraftAssembledReport(createDemoSection())` |
| `reports/[reportId]/page.tsx` | session + report + exportJob | `defaultViewerSession` + `null` + `null` |
| `reports/history/page.tsx` | session + archive summaries | `defaultViewerSession` + `[]` |
| `admin/page.tsx` | session + admin snapshot | `defaultHeadSession` + `defaultSnapshot` |

**Exported** `defaultSnapshot` from `admin-runtime.ts` for deterministic server rendering.

### Task 2: Remove locale/time-dependent render divergence

No additional locale/time divergence found — all date values in the codebase are hardcoded ISO strings (`new Date('2026-04-06T...')`), not `new Date()` or locale-sensitive formatting. The `useBrowserState` hook already handles the remaining nondeterminism (browser-backed state).

### Task 3: Re-run browser validation

- **TypeScript typecheck**: PASS (zero errors)
- **Test suite**: PASS 3 / FAIL 24 — identical to pre-change baseline. All 24 failures are pre-existing (`document is not defined` — missing jsdom environment in vitest config for component tests). Zero regressions introduced.

## Files changed

- `apps/web/src/lib/use-browser-state.ts` (NEW)
- `apps/web/src/app/(app)/lead/report/page.tsx`
- `apps/web/src/app/(app)/head/dashboard/page.tsx`
- `apps/web/src/app/(app)/head/report/page.tsx`
- `apps/web/src/app/(app)/reports/[reportId]/page.tsx`
- `apps/web/src/app/(app)/reports/history/page.tsx`
- `apps/web/src/app/(app)/admin/page.tsx`
- `apps/web/src/components/admin/admin-runtime.ts`
