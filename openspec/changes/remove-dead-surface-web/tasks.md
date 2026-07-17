# Tasks

## 1. Pin current behavior before deleting (regression guards)

- [ ] 1.1 Confirm no production import of `stageNameMatches`, `visibleLeadSlidePeriodOptions`, `applyStatusSuggestion`, `syncSource`, or `getDialogPreset` anywhere under `apps/web/src` outside their own test files (grep before touching code; re-grep after each deletion).
- [ ] 1.2 Confirm every existing call site of `handleStageStatusChange` (hook + `lead-form-sync-bridge.tsx` + tests) so the parameter removal covers all of them.

## 2. Remove dead surface — model layer

- [ ] 2.1 Delete `stageNameMatches` from `apps/web/src/features/report-sections/model/stage-tags.ts`.
- [ ] 2.2 Delete its test cases from `apps/web/src/features/report-sections/model/stage-tags.test.ts`; keep `splitStageNames`/`joinStageNames` coverage intact.
- [ ] 2.3 Delete `visibleLeadSlidePeriodOptions` from `apps/web/src/features/slides/model/lead-slide-periods.ts`.
- [ ] 2.4 Delete its test cases from `apps/web/src/features/slides/model/lead-slide-periods.test.ts`; keep `buildLeadSlidePeriodOptions`/`resolveLeadSlideReportId` coverage intact.

## 3. Remove dead surface — hook contract

- [ ] 3.1 In `apps/web/src/hooks/use-status-risk.ts`, delete `applyStatusSuggestion`, the `syncSource` getter, `syncSourceRef`, and the `SyncSource` type/export; drop the `source?`/`_source` parameter from `handleStageStatusChange` and its interface entry.
- [ ] 3.2 Update `apps/web/src/features/report-sections/ui/lead-form-sync-bridge.tsx` call sites of `handleStageStatusChange` to drop the now-removed `"user"`/`"auto-sync"` argument.
- [ ] 3.3 Delete "Test 3" (`applyStatusSuggestion`/`syncSource`) from `apps/web/src/hooks/use-status-risk-sync.test.tsx`; update remaining tests' `handleStageStatusChange` calls to drop the removed argument.

## 4. Remove dead surface — UI layer

- [ ] 4.1 Delete `getDialogPreset` and `PresetConfig` from `apps/web/src/shared/ui/confirmation-dialog.tsx`.
- [ ] 4.2 Delete any `getDialogPreset` test cases from `apps/web/src/shared/ui/confirmation-dialog.test.tsx`.

## 5. Spec bookkeeping

- [ ] 5.1 Add the ADDED requirement to `specs/architecture-refactor-backlog/spec.md` in this change recording the removal.

## Gates

- [ ] 6.1 `pnpm typecheck`
- [ ] 6.2 `pnpm lint`
- [ ] 6.3 `pnpm test`
