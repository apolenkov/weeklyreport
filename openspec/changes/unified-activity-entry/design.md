# Design — unified-activity-entry

MVP. Quick entry + the opt-in by-state view + the позиция lifecycle (resolve-not-delete).
Grilled + adversarially verified (Codex Act-2, 2026-07-01). The lifecycle requirements
state the behavioral invariant; this file holds the technical decisions and the open
problems the review surfaced — kept here, not in the spec, per the layer rule.

## Foundational prerequisite — stable record identity (BLOCKS the lifecycle enforcement)

A позиция (item / risk / decision) has **no identity that survives a save today**.
`saveSection` deletes every item/risk/decision for the section and recreates them with
DB-minted ids on every save (`report-sections.prisma-repository.ts` — the `deleteMany`

- `createMany` block, with the explicit "the DB mints the id — rows are recreated
  wholesale" note). So after any save the row ids change.

This single fact blocks three separate features that all assume a stable record key:

- **This change's lifecycle lock** — "a published record can't be silently removed"
  needs to recognize a published-origin record across saves; row id can't do it.
- **C1 per-record review comments** (`review-acknowledgement`) — a comment anchored to a
  record's id orphans on the next save.
- **C2 move-in-place** — the "move keeps the same `Item.id`" rule below is false against
  the delete-recreate path.

**Decision: introduce a stable record identity first.** A durable per-record key
(a `stableId` / lineage root that is preserved through `saveSection`'s recreate, set once
at creation and copied forward by carry-over) is the prerequisite for all three. Until it
exists, the lifecycle lock is specified (the invariant) but not implementable. This is the
real first task — bigger than this change alone; flagged so it is not discovered at
implementation time.

## Locking by lineage, not by current row id

Carry-over **clones** a carried record into the new period with a NEW id
(`carry-over.service.ts` `cloneCarriedItem` / `cloneUnresolvedDecision`; `CarryOverRecord`
keeps source/target ids only). So the carried instance is a different row. The lock must
therefore key on the record's **lineage root** (the original stableId), not the current
period's row id:

- A carried clone of a published record stays delete-locked (same lineage — it is the
  same позиция continuing), not a fresh deletable draft.
- A genuinely new record created this period (no lineage to a published root) is deletable
  until it is itself published.

## Carry-over scope — risks do not carry today

`carryOver.execute` carries only next-week items and unresolved decisions; **risks are not
carried at all**, and `CarryOverRecord` has no risk lineage. The requirement "an
unresolved risk stays open and carries" is therefore not free. Two honest options:

1. Extend carry-over to risks (add risk cloning + lineage + tests). Larger.
2. Consciously exclude risks from carry-over (a risk is re-raised, not carried) and narrow
   the requirement to items + decisions.

Pick at implementation; do not assume risk carry-over exists.

## Surfacing uncarried open work — needs a response channel

The publish/period response is `{ success, reportId }` today (`period.service.ts`); there
is no channel for an "N open items won't continue" signal. Surfacing uncarried open work
(at the newly opened period, where carry-over is available — NOT at publish of the prior
period, which may predate the next period existing) needs an explicit API/UI contract:
a query that returns the prior period's uncarried open records for the new period's head
view. No silent computation buried in publish.

## Candidate mechanisms considered for the lock (for the record)

- **Diff the save payload against the frozen published snapshot by row id** — REJECTED:
  the snapshot is a serialized read model (`published-report-snapshot.ts`) and row ids do
  not survive saves, so there is nothing stable to match.
- **Compare against the published snapshot by content** — fragile (edits change content)
  and still can't tell an edit from a delete.
- **Stable lineage key + a "first published in period" stamp** — the chosen direction
  (see the prerequisite above): a record carries a durable key; "has been published" is a
  property of that key, checked at save.

## Out of scope (unchanged from proposal)

The carry-over write-path hardening (`fix-carryover-persistence`); the stable-identity
foundation is a prerequisite tracked separately, not built inside this change's first cut.
