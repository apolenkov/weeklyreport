---
phase: 22-interactivity-status-risk-sync
verified: 2026-04-25T23:35:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification:
  initial: true
gaps:
  - truth: "Setting a stage to At Risk or Blocked auto-creates a risk row; filling a risk offers to update the stage status (with user confirmation); SyncSource flag prevents loops"
    status: failed
    reason: "LeadFormSyncBridge component is ORPHANED. The bridge created in plan 22-02 (along with the useStatusRiskSync hook) is not imported anywhere except its own test file. lead-form.tsx renders <SdlcPipeline products={products} readOnly={...}/> and <RisksSection risks={risks} readOnly={...}/> directly, with NO onStatusChange / onChange / onRiskFilled handlers wired. Two TODO(Phase 22) markers remain at lines 630 and 659 explicitly acknowledging the gap. At runtime, clicking a stage chip will silently no-op (optional prop is undefined); risk edits do not persist; status<->risk auto-sync never fires."
    artifacts:
      - path: "apps/web/src/components/lead/lead-form.tsx"
        issue: "Lines 637, 667 — SdlcPipeline and RisksSection rendered without LeadFormSyncBridge wrapper; no onStatusChange / onChange / onRiskFilled props passed; no draftProducts / draftRisks state lifted; saveDraft for stage/risk edits never triggered. Lines 630, 659 contain the TODO(Phase 22) markers proving this."
      - path: "apps/web/src/components/lead/lead-form-sync-bridge.tsx"
        issue: "Component exists, type-checks, and has passing tests, but is never consumed by lead-form.tsx — orphaned production artifact."
      - path: "apps/web/src/hooks/use-status-risk-sync.ts"
        issue: "Hook exists and has 7 passing tests, but only the bridge consumes it; bridge is never mounted in production rendering, so the hook never runs."
    missing:
      - "Import LeadFormSyncBridge into lead-form.tsx and replace direct <SdlcPipeline> + <RisksSection> usage with it (or wire the hook + handlers directly in lead-form.tsx)."
      - "Lift draftProducts and draftRisks state into lead-form.tsx so risk/stage edits flow into the existing draftSection used by autosave."
      - "Wire onStatusChange / onChange / onRiskFilled handlers so saveDraft fires on stage chip and risk edits."
      - "Remove the two remaining TODO(Phase 22) markers at lead-form.tsx:630 and :659."
  - truth: "Web app typechecks cleanly (foundation for any production deployment)"
    status: failed
    reason: "pnpm --filter @customreport/web typecheck fails with 2 errors in apps/web/src/lib/use-cursor-pagination.ts. The hook attempts to read query.data.pages but the local CursorPage<TItem> generic does not surface useInfiniteQuery's InfiniteData<...> page envelope, so .pages is unknown and the .flatMap parameter is implicitly any."
    artifacts:
      - path: "apps/web/src/lib/use-cursor-pagination.ts"
        issue: "Lines 113-115: Property 'pages' does not exist on type 'CursorPage<TItem>' (TS2339); Parameter 'p' implicitly has an 'any' type (TS7006). The generic types passed to useInfiniteQuery do not match the InfiniteData<CursorPage<TItem>> shape that .data actually has."
    missing:
      - "Type-correct the items useMemo: either type query.data as InfiniteData<CursorPage<TItem>>, or adjust generic parameters of useInfiniteQuery to surface .pages, or annotate the flatMap callback explicitly."
      - "After fix, re-run pnpm --filter @customreport/web typecheck and confirm it returns exit 0."
human_verification:
  - test: "Click a stage chip on the Lead Form to mark a stage At Risk; observe a new risk row appears in the Risks section with the same product+stage and severity"
    expected: "An empty risk row appears scoped to the stage, with severity matching the chip"
    why_human: "Confirms SYNC-01 in real DOM after the sync wiring is restored; vitest passes today only because the hook tests are pure-state and the bridge tests render the bridge directly (which lead-form does not use)"
  - test: "Edit a risk text field for a stage that is currently On Track; observe the confirmation dialog asking to update the stage to At Risk"
    expected: "ConfirmationDialog opens; clicking Confirm updates the stage chip; clicking Skip leaves it unchanged"
    why_human: "Confirms SYNC-03 end-to-end; the bridge wires this only when LeadFormSyncBridge is mounted (it is not in lead-form.tsx today)"
  - test: "Submit a section, refresh the page, observe the form is read-only and shows the submitted state"
    expected: "Form locks; banner indicates submission; refresh persists this state"
    why_human: "Confirms INT-01 round-trip persistence (server-side state through real saveDraft + submit calls)"
  - test: "Edit a decision text field, watch the autosave indicator transition Pending -> Saving -> Saved at HH:MM within 3 seconds"
    expected: "Indicator updates and persists across refresh"
    why_human: "Confirms INT-06 timing and INT-04 server persistence beyond what fake-timer unit tests assert"
---

# Phase 22: Interactivity & Status-Risk Sync Verification Report

**Phase Goal:** Every button in the application triggers a real API mutation; stage status changes automatically create risk entries and vice versa.
**Verified:** 2026-04-25T23:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| #   | Truth                                                                                                                                                                       | Status     | Evidence                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lead can submit section (form locks), head can Publish & Lock (period becomes immutable), head can Revoke (section unlocks for re-edit) — all through real API             | ✓ VERIFIED | trpc.reports.submit.mutationOptions @ lead-form.tsx:316; trpc.leadForm.revoke @ :332; trpc.period.publish @ weekly-report-page.tsx:72; trpc.period.reopen @ :87. All wire invalidate{Dashboard,LeadForm,LeadHistory} + toast.success/error.                     |
| 2   | Fill From loads previous period data; Version History shows snapshots and Restore replaces current draft                                                                    | ✓ VERIFIED | trpc.leadForm.fillFrom.mutationOptions @ lead-form.tsx:348; trpc.leadForm.restoreVersion @ :361. Both gated by window.confirm dirty guard at lines 500, 511. mapLeadPeriods exposes sourceSectionId.                                                            |
| 3   | Autosave persists draft changes every 3-5s via debounced mutation; leaving an unsaved form triggers a browser warning                                                       | ✓ VERIFIED | useLeadFormAutosave imported at lead-form.tsx:14, instantiated at :400; hook implements 3000ms debounce + addEventListener('beforeunload') @ use-lead-form-autosave.ts:147; invalidateLeadForm onSuccess @ :100; 7 vitest cases pass.                            |
| 4   | Setting a stage to At Risk or Blocked auto-creates a risk row; filling a risk offers to update the stage status (with user confirmation); SyncSource flag prevents loops    | ✗ FAILED   | LeadFormSyncBridge created and tested but ORPHANED — no production caller imports it; lead-form.tsx renders <SdlcPipeline> + <RisksSection> directly without onStatusChange / onChange / onRiskFilled handlers. Two TODO(Phase 22) markers remain at :630, :659. |
| 5   | Admin CRUD operations (users, products, stages, periods, settings) persist through real tRPC mutations with immediate UI feedback                                          | ✓ VERIFIED | 10 admin.* mutationOptions wired across users-tab, products-tab, periods-tab, reminders-tab, settings-tab, stage-assignment-editor; 14 invalidateAdmin invocations; 0 TODO(Phase 22) in admin/.                                                                  |

**Score:** 4/5 success criteria verified

### Required Artifacts

| Artifact                                                       | Expected                                                       | Status     | Details                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `apps/web/src/hooks/use-lead-form-autosave.ts`                 | Debounced autosave hook + dirty + beforeunload                 | ✓ VERIFIED | Exists, exports useLeadFormAutosave, 3000ms debounce, beforeunload listener, invalidateLeadForm, 7 tests |
| `apps/web/src/hooks/use-status-risk-sync.ts`                   | Bidirectional status<->risk hook + SyncSource ref guard        | ⚠️ ORPHANED | Exists with 7 passing tests. Only consumer is LeadFormSyncBridge — itself orphaned (see below).          |
| `apps/web/src/components/lead/lead-form.tsx`                   | Submit/revoke/fillFrom/restoreVersion + autosave wired          | ✓ VERIFIED | All 4 mutations wired with cache invalidation + toasts; autosave hook instantiated; dirty guard active   |
| `apps/web/src/components/lead/lead-form-sync-bridge.tsx`       | Wrapper composing sync hook + SdlcPipeline + RisksSection       | ⚠️ ORPHANED | Exists, typechecks, 4 tests pass — but no caller in production code imports it.                          |
| `apps/web/src/lib/use-cursor-pagination.ts`                    | Generic cursor pagination over useInfiniteQuery                 | ✗ STUB     | File exists and is consumed by report-archive-section, but **fails typecheck** (TS2339, TS7006).         |
| `apps/web/src/components/admin/users-tab.tsx`                  | Users CRUD wired                                                | ✓ VERIFIED | saveUser + deleteUser mutations + invalidateAdmin + toasts                                                |
| `apps/web/src/components/admin/products-tab.tsx`               | Products CRUD wired                                             | ✓ VERIFIED | saveProject + deleteProject mutations                                                                    |
| `apps/web/src/components/admin/periods-tab.tsx`                | Period CRUD wired                                               | ✓ VERIFIED | savePeriod (no delete endpoint exists at v5.0 — backend gap)                                              |
| `apps/web/src/components/admin/reminders-tab.tsx`              | Reminder rule CRUD wired                                        | ✓ VERIFIED | saveReminderRule + deleteReminderRule                                                                    |
| `apps/web/src/components/admin/settings-tab.tsx`               | Settings update wired                                           | ✓ VERIFIED | updateSettings + invalidateAdmin                                                                          |
| `apps/web/src/components/admin/stage-assignment-editor.tsx`    | Stage assignment CRUD wired                                     | ✓ VERIFIED | saveStageAssignment + deleteStageAssignment                                                              |
| `apps/web/src/components/weekly-report/weekly-report-page.tsx` | Publish & Lock + Reopen mutations                                | ✓ VERIFIED | period.publish + period.reopen wired with cache cascade across dashboard + leadForm + leadHistory          |
| `apps/web/src/components/weekly-report/publish-lock-button.tsx`| Controlled button receiving onPublish/onReopen/periodStatus     | ✓ VERIFIED | Props verified; isPending guard present                                                                   |

### Key Link Verification

| From                                       | To                                       | Via                                                | Status      | Details                                                                                                  |
| ------------------------------------------ | ---------------------------------------- | -------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| lead-form.tsx                              | use-lead-form-autosave.ts                | useLeadFormAutosave({ ... })                       | ✓ WIRED     | Imported @ :14; instantiated @ :400 with reportSectionId/payload/enabled/initialSavedKey                  |
| use-lead-form-autosave.ts                  | cache-keys.ts                            | invalidateLeadForm onSuccess                       | ✓ WIRED     | Line 100                                                                                                  |
| lead-form.tsx                              | cache-keys.ts                            | invalidate{LeadForm,LeadHistory,Dashboard}          | ✓ WIRED     | Multiple onSuccess handlers across 4 mutations                                                            |
| lead-form.tsx                              | LeadFormSyncBridge OR useStatusRiskSync   | render bridge OR mount hook + pass handlers          | ✗ NOT_WIRED | No import of LeadFormSyncBridge or useStatusRiskSync anywhere in lead-form.tsx; SdlcPipeline/RisksSection rendered without sync handlers |
| sdlc-pipeline.tsx                          | useStatusRiskSync (via parent)           | onStatusChange prop set by parent                   | ✗ NOT_WIRED | onStatusChange optional prop is never set by lead-form.tsx — clicks no-op silently                          |
| risks-section.tsx                          | useStatusRiskSync (via parent)           | onChange + onRiskFilled props set by parent          | ✗ NOT_WIRED | Both optional props never set by lead-form.tsx — risk edits go to local state with no persistence           |
| weekly-report-page.tsx                     | period namespace + cache-keys            | period.publish/reopen + invalidate{Dashboard,LeadForm,LeadHistory} | ✓ WIRED     | Verified in lines 72, 87 + onSuccess cascades                                                              |
| admin tabs                                 | cache-keys.ts                            | invalidateAdmin onSuccess (14 sites)                | ✓ WIRED     | grep -c invalidateAdmin in admin/*.tsx returns 14                                                          |
| lead/period-navigator.tsx                  | next/navigation                          | useRouter + usePathname + useSearchParams + router.replace | ✓ WIRED     | Lines 3, 29, 31, 56                                                                                       |
| weekly-report/period-navigator.tsx         | next/navigation                          | router.push(`/reports/${periodId}`)                  | ✓ WIRED     | Lines 50, 56                                                                                              |
| dashboard/report-archive-section.tsx       | useCursorPagination                      | useCursorPagination + fetchNextPage                  | ✓ WIRED     | Lines 19, 45, 51, 115 — but useCursorPagination itself fails typecheck (see artifact gap)                  |

### Data-Flow Trace (Level 4)

| Artifact                                       | Data Variable | Source                              | Produces Real Data | Status            |
| ---------------------------------------------- | ------------- | ----------------------------------- | ------------------ | ----------------- |
| lead-form.tsx (submit/revoke/fillFrom/restore) | mutation IO   | tRPC mutationOptions                | Yes (real API)     | ✓ FLOWING         |
| lead-form.tsx (autosave)                       | draftPayload  | local state mirroring section read  | Yes (real API)     | ✓ FLOWING         |
| lead-form.tsx (stage status / risk edits)      | products / risks | local mock data — no upstream sync  | No (no handlers)    | ✗ DISCONNECTED   |
| weekly-report-page.tsx (publish/reopen)        | mutation IO   | tRPC mutationOptions + view.period.reportId | Yes               | ✓ FLOWING         |
| admin tabs                                     | mutation IO   | tRPC mutationOptions                | Yes                | ✓ FLOWING         |
| report-archive-section.tsx                     | items        | useCursorPagination(trpc.archive.list.infiniteQueryOptions) | Yes (when type compiles) | ⚠️ HOLLOW (typecheck fails — runtime depends on TS-emit ignoring errors) |

### Behavioral Spot-Checks

| Behavior                                          | Command                                                      | Result                              | Status   |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- | -------- |
| Web typecheck passes                              | `pnpm --filter @customreport/web typecheck`                  | 2 errors in use-cursor-pagination.ts | ✗ FAIL   |
| Web vitest passes                                 | `pnpm --filter @customreport/web exec vitest run`            | 156/156 tests across 20 files pass  | ✓ PASS   |
| TODO(Phase 22) markers cleared in admin/          | `grep -rc TODO(Phase 22) apps/web/src/components/admin/`     | 0                                   | ✓ PASS   |
| TODO(Phase 22) markers cleared in weekly-report/  | `grep -rc TODO(Phase 22) apps/web/src/components/weekly-report/` | 0                              | ✓ PASS   |
| TODO(Phase 22) markers cleared in lead/lead-form  | `grep -c TODO(Phase 22) apps/web/src/components/lead/lead-form.tsx` | 2 (SDLC + Risks)               | ✗ FAIL   |
| 10 admin mutationOptions calls                    | `grep -rE 'trpc\.admin\..+\.mutationOptions' apps/web/src/components/admin/ \| wc -l` | 10            | ✓ PASS   |
| LeadFormSyncBridge consumed in production         | `grep -r 'LeadFormSyncBridge' apps/web/src/ --include='*.tsx' \| grep -v test \| grep -v sync-bridge.tsx \| wc -l` | 0 | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                  | Status        | Evidence                                                                          |
| ----------- | ----------- | -------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| INT-01      | 22-01       | Lead Submit triggers real reports.submit + form locks                                          | ✓ SATISFIED   | trpc.reports.submit.mutationOptions @ lead-form.tsx:316                            |
| INT-02      | 22-05       | Head Publish & Lock + Reopen via period.publish / period.reopen                                | ✓ SATISFIED   | weekly-report-page.tsx:72, 87 + cache cascade                                       |
| INT-03      | 22-01       | Head Revoke unlocks a submitted section                                                       | ✓ SATISFIED   | trpc.leadForm.revoke.mutationOptions @ lead-form.tsx:332                           |
| INT-04      | 22-01       | reports.saveDraft persists draft via debounced autosave                                        | ✓ SATISFIED   | useLeadFormAutosave wraps trpc.reports.saveDraft.mutationOptions                    |
| INT-05      | 22-01       | leadForm.fillFrom loads prior period data                                                      | ✓ SATISFIED   | lead-form.tsx:348                                                                   |
| INT-06      | 22-01       | Autosave debounced 3-5s with status indicator                                                  | ✓ SATISFIED   | 3000ms debounce verified in hook source + indicator wired @ lead-form.tsx:524-530   |
| INT-07      | 22-01       | beforeunload guard on dirty form                                                              | ✓ SATISFIED   | window.addEventListener('beforeunload', ...) @ use-lead-form-autosave.ts:147         |
| INT-08      | 22-03       | Cursor pagination on archive.list (+ client reveal on history/versions)                        | ⚠️ PARTIAL    | Wiring present but use-cursor-pagination.ts fails typecheck (TS2339, TS7006)         |
| INT-09      | 22-03       | URL-driven Period Navigators (lead = ?period=, head = /reports/[id])                           | ✓ SATISFIED   | both navigators import next/navigation and call replace/push correctly              |
| INT-10      | 22-04       | Admin CRUD persists via real tRPC mutations (users/products/stages/periods/reminders/settings) | ✓ SATISFIED   | 10 mutationOptions across 6 tabs + 14 invalidateAdmin sites + 0 TODO markers         |
| SYNC-01     | 22-02       | Stage -> At Risk/Blocked auto-creates risk row                                                 | ✗ BLOCKED     | Hook + bridge implemented, but bridge ORPHANED — never rendered by lead-form.tsx     |
| SYNC-02     | 22-02       | Empty auto-created risk row blocks save until filled                                           | ✗ BLOCKED     | Same as SYNC-01 — auto-creation path never executes in production                  |
| SYNC-03     | 22-02       | Risk fill on On Track stage suggests stage update via confirmation dialog                       | ✗ BLOCKED     | Same as SYNC-01 — confirmation flow never reachable                                |
| SYNC-04     | 22-02       | SyncSource ref prevents loops                                                                  | ⚠️ PARTIAL    | Implemented in hook (test 6 proves it), but not exercised in production until bridge mounts |

### Anti-Patterns Found

| File                                                  | Line(s) | Pattern                  | Severity   | Impact                                                                                |
| ----------------------------------------------------- | ------- | ------------------------ | ---------- | ------------------------------------------------------------------------------------- |
| apps/web/src/components/lead/lead-form.tsx            | 630, 659| `TODO(Phase 22)` markers | 🛑 Blocker | Acknowledges that SDLC and Risks saveDraft + status-risk sync wiring is NOT done       |
| apps/web/src/components/lead/lead-form.tsx            | 637     | `<SdlcPipeline products={products} readOnly={isReadOnly}/>` (no onStatusChange) | 🛑 Blocker | Stage chip clicks no-op silently — INT/SYNC primary user surface broken                 |
| apps/web/src/components/lead/lead-form.tsx            | 667     | `<RisksSection risks={risks} readOnly={isReadOnly}/>` (no onChange/onRiskFilled) | 🛑 Blocker | Risk edits never persist; risk-to-stage suggestion never triggers                       |
| apps/web/src/lib/use-cursor-pagination.ts             | 113-115 | TS2339 + TS7006 errors    | 🛑 Blocker | Web app does not typecheck; CI / production build will reject this                    |
| apps/web/src/components/lead/lead-form-sync-bridge.tsx| whole   | Orphaned production artifact (only test file consumes it) | ⚠️ Warning | The work of plan 22-02 is real but unreachable until lead-form.tsx imports the bridge |

### Human Verification Required

#### 1. Stage chip -> Risk row auto-creation (SYNC-01)

**Test:** In a running app, open the Lead Form, click a stage chip on a product to mark a stage At Risk.
**Expected:** A new empty risk row appears in the Risks section, scoped to that product+stage with severity matching the chip.
**Why human:** Vitest passes today only because hook tests are pure-state and bridge tests render the bridge directly. Lead-form.tsx does not mount the bridge, so the production rendering path is broken. Spot-check confirms the gap end-to-end after fix.

#### 2. Risk fill on On Track stage -> confirmation dialog (SYNC-03)

**Test:** Edit risk text for a stage that is currently On Track.
**Expected:** A ConfirmationDialog opens asking to update the stage; Confirm updates it, Skip leaves it.
**Why human:** Same gap as SYNC-01; only reachable when the bridge or its hook is actually mounted in lead-form.tsx.

#### 3. Submit round-trip persistence (INT-01)

**Test:** Submit a section, refresh the page, observe the form is read-only.
**Expected:** Form stays locked; banner indicates submission state.
**Why human:** Confirms the real API call landed in the database, not just that toast.success fired in the test.

#### 4. Autosave timing + persistence (INT-04, INT-06)

**Test:** Edit a decision text field; watch the autosave indicator transition Pending -> Saving -> Saved at HH:MM within 3 seconds; refresh the page; observe the edit persists.
**Expected:** Indicator updates; refresh shows saved value.
**Why human:** Vitest uses fake timers; real-world latency + server persistence are not asserted by unit tests.

### Gaps Summary

Phase 22 delivered the majority of its goal: **buttons fire real mutations** across the Lead Form (submit, revoke, fillFrom, restoreVersion, autosave), Weekly Report (publish, reopen), Admin CRUD (10 mutations across 6 tabs), and URL-driven Period Navigators. INT-01..07, INT-09, INT-10 are satisfied; INT-02 is satisfied. **156/156 vitest cases pass.**

Two material gaps block full phase completion:

1. **Status<->Risk Sync is unreachable in production (SYNC-01..04 BLOCKED).** Plan 22-02 built the LeadFormSyncBridge component and the useStatusRiskSync hook with comprehensive tests, but plan 22-01 did not import or render the bridge. The lead-form.tsx still has the two TODO(Phase 22) markers (lines 630 and 659) acknowledging the missing wiring. SdlcPipeline.onStatusChange and RisksSection.onChange/onRiskFilled are optional props and remain undefined in production, so stage chip clicks and risk edits never produce side effects. The work is built; it just isn't plugged in. This is a coordination gap between 22-01 and 22-02 that neither plan's verification caught because each plan tested its own files in isolation.

2. **Web app fails typecheck (INT-08 PARTIAL).** Two TS errors in use-cursor-pagination.ts (lines 113-115). The runtime is functioning (vitest passes via esbuild which ignores type errors), but `pnpm --filter @customreport/web typecheck` returns exit 1, which blocks any production build pipeline that gates on `tsc --noEmit`. Plan 22-02's deferred-items.md and plan 22-01's SUMMARY both note these errors as out-of-scope; plan 22-03's SUMMARY claims "TypeScript: No errors found" — that claim does not hold in the merged tree.

A single follow-on plan can close both: (a) import LeadFormSyncBridge into lead-form.tsx, lift draftProducts/draftRisks into the form, and remove the two TODO markers; (b) fix the InfiniteData<CursorPage<TItem>> typing in use-cursor-pagination.ts.

---

_Verified: 2026-04-25T23:35:00Z_
_Verifier: Claude (gsd-verifier)_
