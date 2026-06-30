## Why

`make-publish-atomic` turned both manual publish writes into a compare-and-set
keyed on `periodStatus != "published"`, but neither manual predicate also
excludes `archived`. An `archive` transition sets `archived = true` and
`periodState = archived` while leaving the legacy `periodStatus` at `open` /
`reopened` (the dual-state tuple is not collapsed on archive). So a publish that
reads the row as non-archived, then races an archive landing inside its
read→write window, still matches its own `periodStatus != "published"` predicate
and transitions the **archived** row to published — producing a contradictory
`archived = true` AND `periodStatus = "published"` row. Both manual paths are
affected:

- `period.publish` → `PeriodService.publishPeriod` →
  `period.prisma-repository.ts::publishPeriod` (predicate `{ id, periodStatus != "published" }`).
- `review.publish` → `PublicationService.publishReport` →
  `publication.prisma-repository.ts::publishAssembledReport` (predicate `{ id, periodStatus != "published" }`).

The scheduler path (`saveAutoPublishedReport`) already carries
`archived: false` (`guard-autopublish-archived`) and is **not** affected.

Separately, `scope-period-lifecycle-authz` restricts a non-admin head's
publish/reopen target to the server-derived active period, but
`PeriodService.publishPeriod` **blanket-skips** that frontier check for ANY
`periodStatus === "reopened"` target. If an admin reopens a historical period
while a newer period is current-editable, a head can `period.publish` that
historical reopened period — a bypass of the guard that ships in `#14`. This is
the low-severity "MAJOR #2" Codex flagged against `fb7be80c`.

Source: Wave B handoff `docs/handoff/OVERNIGHT-2026-06-30.md` (§Session 3,
follow-up #1) — the `#16` deferred archive race + the `#14` reopened bypass.

## What Changes

- Add `archived: false` to the compare-and-set predicate of BOTH manual publish
  writes (`publishPeriod`, `publishAssembledReport`), so a period archived inside
  the read→write window matches zero rows and is never published.
- On a zero-row match, distinguish the two causes by re-reading the row inside
  the same transaction: a now-`published` row means a concurrent publish won —
  idempotent success, unchanged; a now-`archived` row means the archive landed in
  the window — surface a domain "archived period cannot be published" error
  (FORBIDDEN), NOT a silent idempotent success. The contradictory published-archived
  row is never written.
- Close the reopened-target bypass: when `PeriodService.publishPeriod` sees a
  `periodStatus === "reopened"` target, accept it only if it is the single active
  reopened period (`reportId === getReopenedNonArchivedId()`), instead of skipping
  the frontier check unconditionally. The legitimate reopen→fix→republish flow is
  unaffected (the head's own reopened period IS that single active one).

## Non-goals

This change supersedes the deferred `harden-head-lifecycle-mutation-authz` authz
expansion. The product owner has decided the head is a trusted role that may act
on any period; therefore this change does NOT:

- Add any new archive / unarchive authorization restriction. `archiveReport` /
  `unarchiveReport` remain head-accessible and unbounded by period.
- Add a time-frontier guard to close the archive-assisted history walk-back.
  That walk-back is an accepted risk for a trusted head role (product-owner call).
- Touch or weaken `scope-period-lifecycle-authz` (`#14`); the reopened-bypass fix
  only restores that guard's intended behavior on the manual publish path — it
  adds no restriction the legitimate head flow can hit.
- Change any DB schema or migration (MVP phase, no schema change).
- Reconcile the two parallel publish code paths into one; both are made correct
  in place.

## Capabilities

### New Capabilities

- `publish-archive-race-safety`: a manual publish fails closed on a period
  archived inside its read→write window — the compare-and-set excludes `archived`
  and a zero-row match is split into idempotent concurrent-publish success vs an
  archived-in-window domain error — and a reopened publish target is accepted only
  when it is the single active reopened period.

## Impact

- `apps/api/src/modules/period/period.prisma-repository.ts` (`publishPeriod`
  predicate + zero-row re-read discriminator).
- `apps/api/src/modules/period/period.service.ts` (`publishPeriod`: handle the
  archived-in-window signal; replace the blanket reopened-skip with the single
  active-reopened equality check).
- `apps/api/src/modules/publication/publication.prisma-repository.ts`
  (`publishAssembledReport` predicate + zero-row re-read discriminator + a new
  `PublishReportOutcome` status).
- `apps/api/src/modules/publication/publication.service.ts` (`publishReport`:
  surface the archived-in-window outcome as a domain error).
- The `PeriodRepository` / `PublicationRepository` port types and their
  in-memory test repositories (new outcome shape).
- No schema change; no migration.
