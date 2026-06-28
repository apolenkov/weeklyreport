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

## Goals / Non-Goals

**Goals:**

- Exclude archived periods from the auto-publisher candidate set by adding
  `archived: false` to the `findMany` where clause.
- Cover the exclusion with a dedicated unit-test scenario alongside the existing
  auto-publisher tests.

**Non-Goals:**

- Resetting stale `autoPublished`/`autoArchived` audit flags on reopen or
  unarchive round-trips (separate finding `BL-PERIOD-STATE-HYGIENE`).
- Adding a secondary guard inside `publishAuto` itself — the idempotency guard
  (`status==="published"`) is already defense-in-depth; a second guard on
  `archived` there would encode policy in the wrong layer. Candidate filtering
  is the correct prevention point.
- Scoping manual period publish/reopen to reject archived periods for head users
  (`scope-period-lifecycle-authz` change).

## Decisions

**D1 — Filter at the candidate query, not inside `publishAuto`.**
The auto-publisher owns its candidate selection; `PublicationService.publishAuto`
is a generic publication primitive that should not know the scheduler's
routing logic. Adding the guard at the query boundary keeps each layer's
concerns separate and makes the constraint visible to the next reader of the
scheduler.

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

No data migration needed for new deployments. The fix is a single-line addition
to the Prisma `where` clause. Rollout order:

1. Deploy the updated `auto-publisher.scheduler.ts`.
2. Verify the existing scheduler tests pass (`pnpm test`).
3. Optionally query for corrupted rows (`archived=true AND periodStatus='published'`)
   and remediate manually if any are found.
