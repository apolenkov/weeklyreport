## Why

Wave 0 / P0 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`PeriodPrismaRepository.reopenPeriod` writes the reopen transition with an
unconditional `applyTransition` (`tx.report.update({ where: { id } })`) and no
`archived` / `periodStatus` predicate, then resets that report's `submitted`
sections to `draft` in the same transaction — but the section reset is not
gated on the transition having actually matched a still-reopenable row. The
service's `archived` and `periodStatus === "published"` guards
(`period.service.ts`) are TOCTOU pre-checks: they run three-plus awaited
round-trips before the write, so a head reopen racing an archive resolves them
stale.

Both writers on the losing side of that window are unconditional. Admin manual
archive (`admin-period-lifecycle.ts::archivePeriod` →
`period-admin.service.ts::archivePeriod`) does `report.update` with no
server-side state pre-check and no config gate; the auto-archiver filters
candidates but still issues per-row unconditional updates. When a head reopen
and an archive interleave, the row can land as an archived period whose
sections were silently reset to draft, or `archived=true` alongside a stale
`periodStatus="reopened"` — the exact silent corruption of the load-bearing
period-dual-state invariant (no DB constraint backstops it) that the sibling
publish path already closed via `publishCompareAndSet`
(`openspec/specs/publish-compare-and-set`). Reopen is the same race class on
the other leg, reachable through the always-available manual admin archive.

## What Changes

- Add a guarded compare-and-set for reopen, mirroring
  `apps/api/src/lib/publish-compare-and-set.ts`. It runs
  `tx.report.updateMany({ where: { id, archived: false, periodStatus: "published" }, data: buildTransition("reopen", { now }) })`
  and classifies a `count === 0` match as a fail-closed domain error rather than
  a silent no-op. The `archived: false` and `periodStatus: "published"` clauses
  are the single point that closes the reopen-versus-archive race.
- Rewrite `PeriodPrismaRepository.reopenPeriod`
  (`apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`) to
  route the transition through that guarded compare-and-set instead of
  `applyTransition`, and gate the `reportSection.updateMany` draft-reset on the
  compare-and-set having transitioned the row — so an archive that won the race
  can never leave sections reset behind an archived period.
- Give admin manual archive a matching guarded predicate. `archivePeriod`
  (`apps/api/src/modules/admin/admin-period-lifecycle.ts`) becomes a guarded
  `report.updateMany({ where: { id, archived: false }, data: buildTransition("archive", {}) })`
  and reports a `count === 0` match as a fail-closed already-archived domain
  error, so the archive write is no longer unconditional and the two-actor race
  is closed from both sides. `PeriodAdminService.archivePeriod`
  (`apps/api/src/modules/admin/period-admin.service.ts`) surfaces that outcome.
- Both guarded writes keep sourcing their complete lifecycle field set from
  `buildTransition`, preserving the single-transition-writer invariant; no
  transition builder output changes.
- Add an integration test alongside
  `apps/api/src/modules/period/infrastructure/period.publish-atomicity.integration.test.ts`
  that drives a concurrent reopen-versus-archive against real Postgres and
  asserts no editable-archived or sections-reset-behind-archived row is ever
  committed.

## Capabilities

### New Capabilities

- `reopen-compare-and-set`: the guarded compare-and-set that makes head reopen
  and admin archive mutually exclusive under concurrency, fail-closed on a
  zero-row match, with the section reset gated on the transition.

### Modified Capabilities

(none)

## Impact

- `apps/api/src/lib/` (new reopen compare-and-set helper)
- `apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`
- `apps/api/src/modules/admin/admin-period-lifecycle.ts`
- `apps/api/src/modules/admin/period-admin.service.ts`
- `apps/api/src/modules/period/infrastructure/period.reopen-atomicity.integration.test.ts` (new)

Non-goals: the auto-archiver scheduler's per-row update is not rewritten here
(its candidate filter plus the reopen-side `periodStatus="published"` predicate
already make it lose to reopen cleanly); the service-layer pre-checks stay in
place as fast-path friendly-error guards — the compare-and-set is the atomic
backstop beneath them, not a replacement; no change to publish
compare-and-set or to any `buildTransition` field set.
