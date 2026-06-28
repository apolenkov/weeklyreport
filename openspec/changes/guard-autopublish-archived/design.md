## Context

`AutoPublisherScheduler.runOnce` queries for `Report` rows with
`{status:"draft", deadline<cutoff}` and calls `PublicationService.publishAuto`
for each. The `archive` transition (`buildTransition("archive")`) only sets
`archived=true` and `periodState="archived"`; it does not change `status`. An
open/draft period archived by an admin therefore retains `status="draft"` after
archiving, and its `deadline` does not change. If `autoPublishAfterDeadline=true`,
the next hourly tick picks it up, calls `publishAuto`, and the resulting row has
`archived=true, periodState="published"` — an invalid dual-state combination that
surfaces the period to viewers.

The sibling `AutoArchiverScheduler` already carries `archived:false` in its
candidate query (added when the reopened-period guard was introduced).

**Read-then-write race.** `runOnce` selects candidate ids (`findMany`), then
calls `publishAuto(id)` per candidate, which re-reads the row and writes via
`saveAssembledReport` (`update where:{id}`). The candidate filter alone does
not close a time-of-check-to-time-of-use gap: if an admin archives a draft
_after_ `findMany` selected it but _before_ the per-candidate write, the write
still fires. The idempotency guard inside `publishAuto` checks only
`status==="published"`, but `archive` leaves `status="draft"`, so it does not
catch this case. The `autoPublish` transition does not clear `archived`, so the
write produces `archived=true, periodState="published"` — the same invalid
dual-state the candidate filter was meant to prevent.

## Goals / Non-Goals

**Goals:**

- Exclude archived periods from the auto-publisher candidate set by adding
  `archived: false` to the `findMany` where clause.
- Close the read-then-write race by making the auto-publish write conditional on
  the row still being `status="draft"` and `archived=false` (compare-and-set), so
  a period archived after candidate selection is never promoted.
- Cover both the candidate exclusion and the race with dedicated unit-test
  scenarios alongside the existing auto-publisher tests.

**Non-Goals:**

- Resetting stale `autoPublished`/`autoArchived` audit flags on reopen or
  unarchive round-trips (separate finding `BL-PERIOD-STATE-HYGIENE`).
- Scoping manual period publish/reopen to reject archived periods for head users
  (`scope-period-lifecycle-authz` change).

## Decisions

**D1 — Filter at the candidate query (primary, necessary but not sufficient).**
The auto-publisher owns its candidate selection, so adding `archived: false` to
the `findMany` where clause is the cheapest place to exclude the common case and
makes the constraint visible to the next reader of the scheduler. This removes
archived periods that were already archived when the tick began, but it does not
by itself close the read-then-write race (see D3).

**D3 — Guard the auto-publish write with a compare-and-set.**
The candidate filter cannot cover a period archived _between_ `findMany` and the
per-candidate write. To close that gap, the auto-publish write SHALL be
conditioned on the row still being `status="draft"` and `archived=false` at write
time — a compare-and-set scoped to the `auto` path of `saveAssembledReport`
(e.g. an `updateMany`/guarded `where` that matches zero rows and is skipped when
the period was archived or already published after selection). This stays on the
auto path only; the manual `publishReport` path keeps its existing `where:{id}`
write. The `status==="published"` idempotency check in `publishAuto` is retained
but is not sufficient on its own, because `archive` leaves `status="draft"`.

**D2 — Mirror the auto-archiver spelling exactly.**
The auto-archiver uses `archived: false` (a Prisma scalar equality filter).
Using the same field and spelling in the auto-publisher removes the question
of whether `periodState: { not: "archived" }` would be an equivalent alternative
(it would not fully protect: the `archive` transition for a draft period sets
`periodState="archived"` but the Prisma filter on `periodState` adds no
protection against future states; `archived` is the single source of truth for
the "has been deliberately archived" bit).

## Risks / Trade-offs

- **Already-corrupted rows**: any row already in the `archived=true,
periodState="published"` state is not corrected by this change. A one-shot
  data migration is not included in this scope; if such rows exist they can be
  corrected manually or via a targeted admin script. The risk is low (the bug
  requires `autoPublishAfterDeadline=true` plus an explicit admin archive of a
  draft period, which is non-default).
- **No schema change**: the fix is purely in application logic — no migration,
  no Prisma schema change, no shared-schema update needed.

## Migration Plan

No data migration needed for new deployments. The fix is application logic only —
the candidate-query filter plus the compare-and-set write guard. Rollout order:

1. Deploy the updated `auto-publisher.scheduler.ts`.
2. Verify the existing scheduler tests pass (`pnpm test`).
3. Optionally query for corrupted rows (`archived=true AND periodStatus='published'`)
   and remediate manually if any are found.
