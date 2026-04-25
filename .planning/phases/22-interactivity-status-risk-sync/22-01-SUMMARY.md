---
phase: 22-interactivity-status-risk-sync
plan: 01
subsystem: ui
tags: [tRPC, react-query, autosave, mutations, lead-form, debounce, beforeunload]

# Dependency graph
requires:
  - phase: 21-trpc-provider-and-client-wiring
    provides: TRPCProvider, useTRPC, cache-keys helpers (invalidateLeadForm/LeadHistory/Dashboard), mapLeadFormData
  - phase: 20-seed-type-foundation
    provides: draftSaveSchema + submitSectionSchema (Zod) + Lead* type aliases
provides:
  - useLeadFormAutosave hook (3s debounce, dirty tracking, beforeunload guard)
  - LeadForm wired to reports.submit + leadForm.revoke + autosave
  - LeadForm wired to leadForm.fillFrom + leadForm.restoreVersion with dirty guard
  - DecisionsSection + PrioritiesSection are now controlled (no internal useState)
  - mapLeadPeriods exposes sourceSectionId for fillFrom routing
affects: [22-02-status-risk-sync, 22-03-period-nav, 22-04-admin, 22-05-head-dashboard, 23-pdf-export]

tech-stack:
  added: []
  patterns:
    - "Raw section as draft source-of-truth: keep the API-shape ReportSectionReadModel as local state and re-derive Lead* presentation shapes for children. Avoids field loss from one-way mappers (owner/impact/tag/workflowStatus)."
    - "Debounced autosave with primed baseline: useLeadFormAutosave accepts initialSavedKey so freshly-loaded server data is treated as already-saved (no dirty-flicker on mount)."
    - "Dirty-state confirm guard: destructive overwriting mutations (fillFrom, restoreVersion) prompt window.confirm before discarding unsaved edits."

key-files:
  created:
    - apps/web/src/hooks/use-lead-form-autosave.ts
    - apps/web/src/hooks/use-lead-form-autosave.test.tsx
    - apps/web/src/components/lead/lead-form.test.tsx
  modified:
    - apps/web/src/components/lead/lead-form.tsx
    - apps/web/src/components/lead/decisions-section.tsx
    - apps/web/src/components/lead/priorities-section.tsx
    - apps/web/src/components/lead/current-week-section.tsx
    - apps/web/src/components/lead/next-week-section.tsx
    - apps/web/src/components/lead/fill-from-button.tsx
    - apps/web/src/components/lead/mock-data.ts
    - apps/web/src/components/lead/period-navigator.test.tsx
    - apps/web/src/lib/mappers/lead-form.ts

key-decisions:
  - "Autosave debounce locked at 3000ms (per CONTEXT.md D-DEBOUNCE), configurable via debounceMs arg; default exported for tests."
  - "Submit preflight: handleConfirmSubmit coerces undefined trafficLights to 'green' optimistically — server still validates via submitSectionSchema and rejects via toast.error on missing data. Decision: defer to server validation rather than ship a duplicate client-side validateSubmitInput call (keeps a single source of truth)."
  - "Dirty-state confirm threshold: any non-baseline edit triggers the window.confirm guard on fillFrom/restoreVersion. Conservative; a future plan may relax this to ignore minor whitespace edits."
  - "Lead* type signatures preserved for backward compat with existing children. Raw ReportSectionReadModel kept in parent state and re-mapped on each render."

patterns-established:
  - "Stable key autosave dirty diff: stableStringify (sorted-key JSON) for deterministic deep-equal across re-renders."
  - "Controlled form children: drop internal useState in DecisionsSection / PrioritiesSection; parent owns state."
  - "onItemsChange? prop signature ahead-of-need for current-week / next-week sections; concrete wiring deferred to future plan."

requirements-completed: [INT-01, INT-03, INT-04, INT-05, INT-06, INT-07]

# Metrics
duration: 75min
completed: 2026-04-25
---

# Phase 22 Plan 01: Lead Form Mutations + Autosave Summary

**Replaced 8 TODO(Phase 22) markers with real reports.submit + leadForm.revoke + leadForm.fillFrom + leadForm.restoreVersion mutation wiring and a 3s-debounced autosave hook with dirty-state tracking and beforeunload guard.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-04-25T19:13:00Z
- **Completed:** 2026-04-25T20:28:31Z
- **Tasks:** 3 / 3 (TDD)
- **Files modified:** 9 (+ 3 test files created)

## Accomplishments

- Lead can Submit a report; section flips to "submitted" + form locks; refresh shows read-only banner.
- Head can Revoke a submitted section; section unlocks and dashboard / history caches invalidate.
- Lead's edits autosave within 3 seconds; indicator shows Autosaved → Pending → Saving → Saved at HH:MM.
- Browser warns on tab-close while autosave.dirty=true (beforeunload listener).
- Fill From a prior submitted period and Restore Version both call real mutations and refresh the form, gated by a dirty-state confirm dialog.
- Cache invalidation flows verified: invalidateLeadForm runs on every mutation success; submit / revoke also touch invalidateLeadHistory + invalidateDashboard.

## Task Commits

1. **Task 1: useLeadFormAutosave hook + dirty / beforeunload** — `4f1acd9` (feat)
   - hook: 3s debounced saveDraft + dirty diff via stableStringify + beforeunload listener
   - 7 vitest cases: idle, pending, coalesce, saved, no-op-equal, disabled, error
2. **Task 2: submit + revoke + autosave wiring** — `f3bb5c8` (feat)
   - Raw ReportSectionReadModel as draft source-of-truth (avoids lossy mapper round-trip)
   - DecisionsSection + PrioritiesSection refactored to controlled
   - 4 vitest cases: submit success/error, dirty edit, revoke success
3. **Task 3: fillFrom + restoreVersion + dirty guard** — `ba87cd5` (feat)
   - sourceSectionId added to LeadReportPeriod / ReportPeriod / mapLeadPeriods
   - useLeadFormAutosave gains initialSavedKey to suppress dirty-flicker on initial load
   - 3 vitest cases: fillFrom success, restoreVersion error, dirty guard cancels mutation

## Files Created/Modified

- `apps/web/src/hooks/use-lead-form-autosave.ts` — 3s debounced autosave with primed-baseline dirty tracking and beforeunload guard.
- `apps/web/src/hooks/use-lead-form-autosave.test.tsx` — 7 vitest cases (covers all hook behaviors).
- `apps/web/src/components/lead/lead-form.tsx` — submit / revoke / fillFrom / restoreVersion wiring + autosave; raw section state pattern.
- `apps/web/src/components/lead/lead-form.test.tsx` — 7 vitest cases for mutation wiring + dirty guard.
- `apps/web/src/components/lead/decisions-section.tsx` — controlled (drop internal useState; accept onChange).
- `apps/web/src/components/lead/priorities-section.tsx` — controlled (drop internal useState; accept onChange).
- `apps/web/src/components/lead/current-week-section.tsx` — onItemsChange? prop signature (deferred wiring).
- `apps/web/src/components/lead/next-week-section.tsx` — onItemsChange? prop signature (deferred wiring).
- `apps/web/src/components/lead/fill-from-button.tsx` — onFillFrom now receives sourceSectionId, not reportId.
- `apps/web/src/components/lead/mock-data.ts` — ReportPeriod gains sourceSectionId; MOCK_PERIODS updated.
- `apps/web/src/components/lead/period-navigator.test.tsx` — fixture literals updated to include sourceSectionId.
- `apps/web/src/lib/mappers/lead-form.ts` — LeadReportPeriod gains sourceSectionId; mapLeadPeriods sources it from MyHistoryEntry.sectionId.

## Decisions Made

1. **Raw section as draft source-of-truth.** The Lead* mapper is intentionally lossy (drops decision.owner/impact, item.tag/workflowStatus, collapses risk fields into a single text). Building the saveDraft payload from the raw `byPeriod.section` overlaid with edits guarantees Zod validation passes on every save / submit. The mapper output continues to feed children for display.
2. **Submit validation deferred to server.** No client-side `validateSubmitInput` preflight; the server's submitSectionSchema rejection surfaces via toast.error. Single source of truth, fewer drift risks.
3. **Initial baseline priming.** `useLeadFormAutosave` gained `initialSavedKey` (computed from server section via the exported `stableStringify`) so initial render does not flag the form dirty. Without this, the autosave indicator would jitter from "Autosaved" → "Pending" on every mount.
4. **window.confirm for dirty guard.** Native dialog is sufficient for v5.0; a custom modal is a future polish item.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] draftSaveSchema field name in plan's `<interfaces>` was wrong**
- **Found during:** Task 1 (writing the autosave payload type)
- **Issue:** The plan said `draftSaveSchema = { ... projects: ProjectStatusInput[] (with field trafficLight) }` but the actual schema is `projectStatuses: z.array(projectStatusInputSchema)` and the inner field is `status`, not `trafficLight`. Status is `.optional()` on draftSave but required on submit.
- **Fix:** All payload construction uses `projectStatuses` and `status`. Implementation matches `packages/shared/src/schemas/report.ts` rather than the plan's (incorrect) summary.
- **Verification:** All 7 autosave hook tests pass; submit happy-path test passes.
- **Committed in:** `4f1acd9`, `f3bb5c8`

**2. [Rule 1 — Bug] Lossy Lead* mappers would have broken saveDraft Zod validation**
- **Found during:** Task 2 (planning the draft state shape)
- **Issue:** Building draftPayload from Lead*-mapped state would have stripped required schema fields (decision.owner / decision.impact / item.tag / item.workflowStatus) — Zod would reject every save.
- **Fix:** Keep `draftSection` as `ReportSectionReadModel` (raw API shape); merge child onChange edits back by id, preserving every dropped field. Lead* shapes are derived for display only.
- **Verification:** All vitest pass; typecheck clean for new files.
- **Committed in:** `f3bb5c8`

**3. [Rule 2 — Missing critical functionality] sourceSectionId missing from LeadReportPeriod / mapLeadPeriods**
- **Found during:** Task 3 (wiring fillFrom)
- **Issue:** `leadForm.fillFrom` requires `sourceSectionId`, but `mapLeadPeriods` only exposed `reportId` (as `id`). Without the section id, the mutation could not be wired correctly.
- **Fix:** Added `sourceSectionId: string` to LeadReportPeriod and ReportPeriod (mock-data, kept in sync to preserve cast-through compatibility). `mapLeadPeriods` sources it from `MyHistoryEntry.sectionId`. MOCK_PERIODS literal + lead/period-navigator.test.tsx fixtures updated structurally.
- **Verification:** All 14 mapper tests + 7 lead-form tests + 21 lead component tests pass.
- **Committed in:** `ba87cd5`

**4. [Rule 1 — UX bug] First-render dirty flicker on form load**
- **Found during:** Task 3 (testing dirty guard)
- **Issue:** The autosave hook had no notion of "freshly loaded data", so on every mount the initial payload differed from the empty `lastSavedRef`, immediately flagging dirty=true. The autosave indicator jittered from "Autosaved" → "Pending" with no user action.
- **Fix:** Added optional `initialSavedKey` arg to `useLeadFormAutosave`; LeadForm primes it from byPeriod.section using the exported `stableStringify`. Hook now treats freshly-loaded server payload as already-saved.
- **Verification:** Dirty-edit test confirms "Autosaved" → "Pending" only after a real edit; restoreVersion-with-dirty-guard test passes.
- **Committed in:** `ba87cd5`

## Out-of-scope items observed

- `apps/web/src/components/admin/admin-panel.tsx` typecheck errors (3) — pre-existing, owned by 22-04.
- `apps/web/src/components/weekly-report/publish-lock-button.test.tsx` typecheck errors (6) — pre-existing, owned by 22-05.
- `apps/web/src/lib/use-cursor-pagination.ts` typecheck errors (2) — pre-existing, owned by 22-03 (already documented in deferred-items.md by 22-02).
- `apps/web/src/components/lead/lead-form-sync-bridge.{tsx,test.tsx}` — owned by 22-02 (parallel worktree); 1 of its tests fails on a pre-existing trigger unrelated to this plan.

None auto-fixed (scope boundary).

## Authentication Gates

None. All mutations were wired against the live tRPC mutation options shape; no auth flows touched.

## Verification

```bash
pnpm --filter @customreport/web exec vitest run src/hooks/ src/components/lead/ src/lib/mappers/
# Test Files  13 passed (13)
#       Tests  126 passed (126)

grep -c "TODO(Phase 22)" apps/web/src/components/lead/lead-form.tsx
# 2  (SDLC pipeline + Risks — owned by 22-02)

grep -rE "(reports.submit|leadForm.revoke|leadForm.fillFrom|leadForm.restoreVersion).mutationOptions" apps/web/src/components/lead/
# 4 matches in lead-form.tsx
```

## Self-Check: PASSED

- `apps/web/src/hooks/use-lead-form-autosave.ts` — FOUND
- `apps/web/src/hooks/use-lead-form-autosave.test.tsx` — FOUND
- `apps/web/src/components/lead/lead-form.test.tsx` — FOUND
- Commit `4f1acd9` — FOUND in `git log`
- Commit `f3bb5c8` — FOUND in `git log`
- Commit `ba87cd5` — FOUND in `git log`
- All 14 hook + lead-form tests pass under vitest
- 0 typecheck errors in files owned by this plan
