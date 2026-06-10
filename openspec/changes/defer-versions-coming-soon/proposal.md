# Defer Version History Behind ComingSoon; Make Saving Maximally Stable

## Why

User decision (2026-06-10, grilled and confirmed): version history is
deferred — too complex for now, and it has a **fidelity bug** that is
the recorded reason for the deferral and the starting point for any
future re-enable change:

> The user restored v3 of their section; the stage statuses shown on
> the page did not match what was saved in that version. A version
> must fully determine page state, and today it does not — snapshots
> created before `stageStatuses` was added to the projection silently
> keep the _current_ statuses on restore
> (`lead-form.prisma-repository.ts:296-303`), so a restored page is a
> mix of two points in time.

Until a version snapshot is a complete, faithful capture of page
state, navigating and restoring versions misleads more than it helps.
The user's #1 ask instead: **saving must be maximally stable.**

## What Changes

1. **UI**: `VersionHistoryNav` (Previous / v3 / Next in the lead
   toolbar) becomes an inert disabled control with a `ComingSoonBadge`
   tooltip, per the deferred-feature pattern (reference:
   `nav-bar.tsx` `LanguageComingSoonControl`). All version wiring in
   `lead-form.tsx` (versions query, snapshot view overlay, restore
   handler) is removed with `TODO(defer-versions-coming-soon)` markers.
2. **Writes disabled** (explicit user choice over keep-writing): the
   autosave/manual-save snapshot trigger (`onSaveSuccessAction` →
   `leadForm.createSnapshot`) is removed; every former call site keeps
   a `TODO(defer-versions-coming-soon)` marker.
3. **Backend loud stubs**: tRPC `leadForm.versions`, `getVersion`,
   `restoreVersion`, `createSnapshot` throw
   `Error("Not implemented — see TODO(defer-versions-coming-soon)")`.
   Services, repository, retention logic, and their integration tests
   stay intact as the preserved behavioral spec for re-enable.
4. **Schema kept**: `VersionSnapshot` table and Zod schemas stay — NO
   destructive migration.
5. **Save stability**: audit autosave + Save-now end-to-end; verify
   removing the snapshot trigger breaks neither path; extend tests for
   debounce coalescing, error surfacing, and manual save (building on
   `save-now-pending-indicator`, which lands earlier tonight).

## Non-goals

- No fix of the fidelity bug itself — that is the future re-enable
  change.
- No removal of `fillFrom`: it stays live; its internal pre-overwrite
  safety snapshot write is retained (see design D3).
- No change to `SaveNowButton` visuals beyond what
  `save-now-pending-indicator` ships.
- No destructive migration, no prod-DB work.

## Capabilities

### Modified Capabilities

- `deferred-feature-pattern`: version history joins the pattern — new
  UI scenario (inert toolbar control) and backend scenario (stubbed
  version endpoints).

## Impact

- `apps/web/src/components/lead/version-history-nav.tsx` (+ test) —
  inert ComingSoon control.
- `apps/web/src/components/lead/lead-form.tsx` — version wiring out.
- `apps/web/src/hooks/use-lead-form-autosave.ts` (+ test) —
  `onSaveSuccessAction` orphan removed; stability tests extended.
- `apps/api/src/infrastructure/trpc/trpc.router.ts:1961-2030` — loud
  stubs on 4 procedures.
- `openspec/specs/deferred-feature-pattern` — delta in this change.
