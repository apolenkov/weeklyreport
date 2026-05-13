---
phase: 22-interactivity-status-risk-sync
plan: 04
subsystem: admin
requirements: [INT-10]
tags: [admin, crud, trpc, mutations, cache-invalidation, toast]
dependency-graph:
  requires:
    - "Phase 21 read-path migration (admin tabs receive snapshot props)"
    - "TRPCProvider mount + invalidateAdmin helper (Phase 21)"
    - "sonner toast container (Phase 21)"
  provides:
    - "Real CRUD persistence for users/products/periods/reminders/settings/stage-assignments"
    - "Form-state -> Zod-input mappers for all admin entity types (toAdminUserInput, toAdminProjectInput, toReportPeriodInput, toAdminReminderRuleInput)"
    - "MockReminder shape carrying API round-trip fields (kind/fireAt/timezone/version/reportId) so any tab-side derived state can rebuild a valid saveReminderRule input"
  affects:
    - "AdminPanel container — child tabs are now controlled (props are source of truth)"
tech-stack:
  added: []
  patterns:
    - "useMutation(trpc.admin.*.mutationOptions({ onSuccess, onError })) with invalidateAdmin + sonner toast"
    - "Form state -> Zod input via dedicated mapper helpers (single source of truth for contract drift)"
    - "Crypto.randomUUID() client-side id generation for new entities (server schema requires uuid; mutation flow tolerates client-allocated ids)"
key-files:
  created: []
  modified:
    - apps/web/src/components/admin/users-tab.tsx
    - apps/web/src/components/admin/products-tab.tsx
    - apps/web/src/components/admin/periods-tab.tsx
    - apps/web/src/components/admin/reminders-tab.tsx
    - apps/web/src/components/admin/settings-tab.tsx
    - apps/web/src/components/admin/stage-assignment-editor.tsx
    - apps/web/src/components/admin/admin-panel.tsx
    - apps/web/src/components/admin/mock-data.ts
    - apps/web/src/lib/mappers/admin.ts
    - apps/web/src/lib/mappers/index.ts
decisions:
  - "MockReminder type was extended with API round-trip fields so toggle/edit reconstructs the saveReminderRule input without a second query. The cleanest alternative (separate raw-rule prop pipe) would have rippled through admin-panel and the snapshot mapper without observable benefit."
  - "Stage-assignment editor renders only stages that already exist on the project. There is no admin.listStages endpoint at v5.0, so creating a brand-new stage row from scratch is impossible — left as a backend gap rather than blocking the plan."
  - "Periods tab supports add + edit only. The admin router does not expose deletePeriod, and the plan explicitly anticipated this; documenting rather than blocking."
  - "client-side crypto.randomUUID is used to mint ids for new entities. The server schemas require a uuid input, and the upsert services accept the supplied id. If a future schema flips id to required server-side, the mappers are the single point of change."
metrics:
  duration: "~25min"
  completed: 2026-04-25
---

# Phase 22 Plan 04: Admin CRUD Wiring Summary

Wire every admin Save/Delete control across the six tabs (users, products, stage assignments, periods, reminders, settings) to real tRPC mutations with invalidateAdmin + sonner toasts; rename inherited `initialX` props to controlled `x` props so the AdminPanel snapshot is the single source of truth.

## What Got Built

Two atomic commits, one per task block of the plan.

| Task | Commit    | Files                                                                                       | Mutations wired                                                                                          |
| ---- | --------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | `4c051a6` | users-tab, products-tab, stage-assignment-editor, admin-panel, mappers/admin, mappers/index | `saveUser`, `deleteUser`, `saveProject`, `deleteProject`, `saveStageAssignment`, `deleteStageAssignment` |
| 2    | `01fc909` | periods-tab, reminders-tab, settings-tab, mock-data, mappers/admin, mappers/index           | `savePeriod`, `saveReminderRule`, `deleteReminderRule`, `updateSettings`                                 |

Total: 10 distinct mutation endpoints across 6 tabs. `invalidateAdmin` is invoked from 14 onSuccess sites (every Save and Delete handler). Zero `TODO(Phase 22)` markers remain in `apps/web/src/components/admin/`.

## Implementation Notes

**Controlled tabs.** Each tab now reads its data directly from the prop supplied by `AdminPanel` (`users`, `products`, `periods`, `reminders`, `settings`). The legacy `useState(initialX) + useEffect(setX)` pattern was removed — `invalidateAdmin` triggers a `snapshot` refetch and the parent re-runs `mapAdminSnapshot`, so children never own server data anymore. SettingsTab is the one exception: it keeps a local `draft` for the half-edited form, re-seeded on prop change.

**Form -> Zod input mappers.** Four helpers landed in `apps/web/src/lib/mappers/admin.ts`:

- `toAdminUserInput(form, existingId?)` -> `adminUserSchema`
- `toAdminProjectInput(form, existingId?)` -> `adminProjectSchema`
- `toReportPeriodInput(form, existingId?)` -> `reportPeriodSchema` (date strings -> `Date`)
- `toAdminReminderRuleInput(form, existingId?)` -> `adminReminderRuleSchema`

Each helper mints a v4 UUID via `crypto.randomUUID()` when no `existingId` is supplied, since every admin schema requires `id: uuid()` (the upsert services accept client-allocated ids). All helpers trim text fields to keep the API surface clean.

**Stage-assignment editor refactor.** The editor is now self-contained: it takes `projectId + projectName + leads` and runs its own `listStageAssignments` query plus `saveStageAssignment`/`deleteStageAssignment` mutations. Reassignment to "Unassigned" calls `delete`; reassignment to a different lead calls `save` with the same `stageId` (the repository upsert keys off `(projectId, stageId)`). Cache invalidation uses `qc.invalidateQueries(trpc.admin.listStageAssignments.pathFilter())`.

**MockReminder shape extension.** The tab needs `kind`, `fireAt`, `timezone`, `version`, `reportId` to rebuild a valid `saveReminderRule` payload from a status toggle alone. These were added to the `MockReminder` type in both the mapper module and `components/admin/mock-data.ts`, plus the existing `MOCK_REMINDERS` fixtures. The snapshot mapper (`mapReminder`) was updated to copy these straight from the API response.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tRPC error type was `TRPCClientErrorLike`, not `Error`**

- **Found during:** Task 1 typecheck
- **Issue:** Initial `onError: (err: Error) => ...` annotation rejected by tRPC v11 — the runtime error shape lacks `name`, so explicit `Error` typing fails.
- **Fix:** Removed the explicit annotation; the inferred `TRPCClientErrorLike` already carries `message`, which is all `toast.error` needs.
- **Files modified:** users-tab, products-tab, stage-assignment-editor (and applied preemptively to periods/reminders/settings)
- **Commit:** `4c051a6`

### Backend Gaps (Deferred)

These do not block plan completion; documented for the next plan / follow-up requirement.

| Gap                        | Impact                                                                                                                                               | Suggested follow-up                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `admin.deletePeriod`    | Periods tab supports add + edit only.                                                                                                                | Add `deletePeriod` to admin router + service.                                                                                                                         |
| No `admin.listStages`      | Stage-assignment editor cannot create new stage rows from scratch — only reassign existing ones. Empty-stage projects show "stage seeding required". | Expose stage catalog (`listStages` returning `Stage[]`) so the editor can render a 7-stage grid with assignable selects even when the project has no assignments yet. |
| No `admin.sendReminderNow` | The "Send Now" button still simulates a 1.5s spinner with no real backend call.                                                                      | Add `sendReminderNow(ruleId)` mutation that enqueues an immediate execution.                                                                                          |

## Verification

- `pnpm --filter @customreport/web exec tsc --noEmit` — all admin files clean (other unrelated parallel-plan errors are out of scope for plan 22-04).
- `pnpm exec vitest run src/lib/mappers/admin src/components/admin` — `PASS (11) FAIL (0)`.
- Acceptance greps:
  - 10 mutation `mutationOptions` calls across `apps/web/src/components/admin/` (≥ 10 required).
  - 14 `invalidateAdmin` invocations (≥ 8 required).
  - 0 `TODO(Phase 22)` markers remaining (= 0 required).
  - 4 form-input mapper helpers exported (≥ 4 required).

## Self-Check: PASSED

- File `apps/web/src/components/admin/users-tab.tsx`: FOUND
- File `apps/web/src/components/admin/products-tab.tsx`: FOUND
- File `apps/web/src/components/admin/periods-tab.tsx`: FOUND
- File `apps/web/src/components/admin/reminders-tab.tsx`: FOUND
- File `apps/web/src/components/admin/settings-tab.tsx`: FOUND
- File `apps/web/src/components/admin/stage-assignment-editor.tsx`: FOUND
- File `apps/web/src/components/admin/admin-panel.tsx`: FOUND
- File `apps/web/src/lib/mappers/admin.ts`: FOUND
- Commit `4c051a6`: FOUND
- Commit `01fc909`: FOUND
