# Remove Version History Entirely; Keep One Plain, Stable Save

## Why

User decision (2026-06-11 morning; SUPERSEDES the 2026-06-10 scope this
change previously carried — "hide UI behind ComingSoon, disable writes,
keep schema"): version history / snapshots are too complex for now and
are removed ENTIRELY — database, backend, and UI. A lead's section keeps
one plain unified saved state, and saving must come out simpler and
maximally stable (the user's #1 ask). Versioning returns later as a
separately designed feature; the `versions-v2-restore-fidelity` research
draft (captured separately, 2026-06-11) starts that design.

Recorded reasons for removal:

1. **Complexity** — write throttling, dedup, retention windows, pinning,
   restore overlays: disproportionate to MVP value.
2. **Fidelity bug** — restoring v3 showed stage statuses that did not
   match the saved state; a version must fully determine page state and
   it did not (`lead-form.prisma-repository.ts:296-303` keeps _current_
   `stageStatus` rows when a snapshot predates the field).

This also SUPERSEDES `add-version-pin` (archived 2026-06-11): its `kind`
pin field, `setVersionPinned` mutation, retention pin-exemption, and pin
star UI are removed by this change, together with its synced durable
spec `openspec/specs/version-pinning`.

## What Changes

1. **Prisma**: drop the `VersionSnapshot` model, the
   `VersionSnapshotKind` enum, and the `ReportSection.versionSnapshots`
   relation; hand-sync the single init migration; `migrate reset` the
   `_dev`/`_test` DBs (MVP DB rule — never prod).
2. **Backend**: delete snapshot creation on autosave/manual-save, the
   retention sweep (and pinned exemption), the pin/unpin mutation, the
   restore/read endpoints (5 tRPC procedures), and the version read
   model in `packages/shared` (`versionSnapshotSchema`, the
   `versionCount`/`latestVersion*` history fields). Removal, not stubs —
   `TODO(versions-v2)` one-liners mark the natural future activation
   points.
3. **Web**: delete `VersionHistoryNav`, the history modal/rows, the pin
   star, and all version wiring in `lead-form.tsx`; an inert
   `ComingSoonBadge` control fills the toolbar slot per the
   deferred-feature pattern. English copy only.
4. **Save stability**: audit autosave + Save-now end-to-end after the
   removal; extend reliability tests (debounce coalescing, error
   surfacing, manual save). Builds on `save-now-pending-indicator`,
   which lands earlier in the queue.

## Non-goals

- No versions-v2 design and no fidelity-bug fix here.
- No removal of `fillFrom`: it stays live; its internal pre-overwrite
  snapshot disappears with the table (design D2).
- No `SaveNowButton` visual change beyond what
  `save-now-pending-indicator` ships.
- No prod-DB operations of any kind.

## Capabilities

### Modified Capabilities

- `deferred-feature-pattern`: version history joins the UI scenario list
  as an inert ComingSoon toolbar control.
- `uat-quality-gates`: the lead re-sweep surface list no longer names
  version history.

### Removed Capabilities

- `version-pinning`: removed wholesale — there is no snapshot to pin.

## Impact

- `prisma/schema.prisma` + the single init migration SQL.
- `packages/shared/src/schemas/stage.schema.ts`, `report.schema.ts`.
- `apps/api/.../report-sections/`: `snapshot.service.ts` (deleted),
  `version-history.service.ts` (only `fillFrom` survives),
  `lead-form.prisma-repository.ts`, version integration tests (deleted),
  `trpc.router.ts` (5 procedures + `myHistory` projection).
- `apps/web/src/components/lead/`: `version-history-nav.tsx`,
  `version-row.tsx` (+ tests, snapshots) deleted; `lead-form.tsx`,
  `mock-data.ts`, `lib/mappers/lead-form.ts`, `lib/mappers/lead-history.ts`,
  `hooks/use-lead-form-autosave.ts`.
- `openspec/specs/`: deltas in this change for the three capabilities
  above.
