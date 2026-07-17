## Why

A code review confirmed several pieces of web-frontend surface have no production
caller, yet each carries dedicated tests that give false coverage confidence — the
tests exercise code no user-facing flow ever runs, and one hook parameter is a
contract lie (it looks meaningful but is ignored):

- `stageNameMatches` (`apps/web/src/features/report-sections/model/stage-tags.ts:73`)
  has a full dedicated test suite but zero production callers.
- `visibleLeadSlidePeriodOptions` (`apps/web/src/features/slides/model/lead-slide-periods.ts:81`)
  is exported and unit-tested but has no production caller — only
  `buildLeadSlidePeriodOptions`/`resolveLeadSlideReportId` are consumed by
  `use-lead-slides-data.ts`. Its trickiest branch (a selected-but-archived option
  re-appended and re-sorted into the visible list, lines 97-104) is also untested:
  every case in `lead-slide-periods.test.ts` passes a non-archived selected id.
- `applyStatusSuggestion` and the `syncSource()` getter
  (`apps/web/src/hooks/use-status-risk.ts:143`) have no production caller — the
  bridge (`lead-form-sync-bridge.tsx`) only calls `handleStageStatusChange` and
  never reads `syncSource`.
- `handleStageStatusChange`'s `_source` parameter
  (`apps/web/src/hooks/use-status-risk.ts:176`) is declared in the interface as
  `source?: SyncSource` implying meaningful behavior, but the implementation
  never reads it — callers passing `"auto-sync"` vs `"user"` get identical
  results. This is a contract lie the interface advertises.
- `getDialogPreset` and its `PresetConfig` switch
  (`apps/web/src/shared/ui/confirmation-dialog.tsx:146`) have no production
  caller — only referenced in its own docstring.

This repo is exemplary-by-default: dead surface with its own test suite is worse
than no test suite, because it signals coverage that doesn't exist for anything
a user can trigger.

## What Changes

- Delete `stageNameMatches` from `stage-tags.ts` and its dedicated test cases in
  `stage-tags.test.ts`.
- Delete `visibleLeadSlidePeriodOptions` from `lead-slide-periods.ts` and its
  test cases in `lead-slide-periods.test.ts` (including the archived-reappend
  case that was going to be added — moot once the function is gone).
- Delete `applyStatusSuggestion` and the `syncSource` getter from
  `use-status-risk.ts`'s public hook result, and delete "Test 3" in
  `use-status-risk-sync.test.tsx` that exercises them.
- Collapse the dead `source?: SyncSource` parameter contract on
  `handleStageStatusChange`: drop the parameter (and the now-unused `SyncSource`
  type / `syncSourceRef`) from the hook's signature and from every call site
  (`lead-form-sync-bridge.tsx`), since the implementation never branched on it.
  Update `use-status-risk-sync.test.tsx` call sites that passed `"user"`
  explicitly.
- Delete `getDialogPreset` and `PresetConfig` from `confirmation-dialog.tsx` and
  any test cases in `confirmation-dialog.test.tsx` that exercise them.
- Record this cleanup in the `architecture-refactor-backlog` spec so future
  reviews don't re-flag the same dead surface.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `architecture-refactor-backlog` — record the removal of six pieces of dead
  web-frontend surface (and their now-orphaned tests) found by code review.

## Impact

- Packages: `@customreport/web`.
- Files:
  - `apps/web/src/features/report-sections/model/stage-tags.ts`
  - `apps/web/src/features/report-sections/model/stage-tags.test.ts`
  - `apps/web/src/features/slides/model/lead-slide-periods.ts`
  - `apps/web/src/features/slides/model/lead-slide-periods.test.ts`
  - `apps/web/src/hooks/use-status-risk.ts`
  - `apps/web/src/hooks/use-status-risk-sync.test.tsx`
  - `apps/web/src/features/report-sections/ui/lead-form-sync-bridge.tsx`
  - `apps/web/src/shared/ui/confirmation-dialog.tsx`
  - `apps/web/src/shared/ui/confirmation-dialog.test.tsx`
  - `openspec/specs/architecture-refactor-backlog/spec.md`

## Non-goals

- No behavior change for any live user flow — `handleStageStatusChange` already
  ignored its source argument, so removing the argument changes nothing
  observable.
- No change to `splitStageNames`/`joinStageNames`/`canonicalStageName` in
  `stage-tags.ts` — those have live callers and stay untouched.
- No change to `buildLeadSlidePeriodOptions`/`resolveLeadSlideReportId` in
  `lead-slide-periods.ts` — those are the functions actually consumed by
  `use-lead-slides-data.ts`.
- No new archived-option test coverage is added for
  `visibleLeadSlidePeriodOptions` — the function is deleted, not fixed, since
  it has no caller to justify keeping it.
- No API/backend changes.
