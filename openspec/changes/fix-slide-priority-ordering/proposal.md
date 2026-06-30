## Why

> **Captured from 2026-06-30 demo feedback (cluster C4). Root cause found — small
> bug fix, not a grill.** See `docs/feedback/demo-2026-06-30.md`.

"Priorities look weird on the slide; they should be ordered." On the slide the
priorities list sorts by `(a.priorityRank ?? 0) - (b.priorityRank ?? 0)`
(`apps/web/src/components/slides/section-slide-utils.ts:188`, and `:261`, `:292`).
The `?? 0` fallback makes **unranked items sort before P1** — an unranked item
(rank `null`) collates as 0, ahead of rank 1 — so the order reads as scrambled.

## What Changes

- Sort priorities with rank-bearing items ascending (P1, P2, …) and unranked items
  **last**, at all three sort sites (section-level :188, per-product :261,
  cross-product :292). Replace the `?? 0` collation with a nulls-last comparator.
- Add a unit test over `buildSectionSlideModel` proving ranked items precede
  unranked ones and ascending rank order holds.

## Capabilities

### New Capabilities

- (none — behavior fix; add a scenario to the relevant slide spec if one governs
  on-slide ordering)

### Modified Capabilities

- (none material)

## Impact

- `apps/web/src/components/slides/section-slide-utils.ts` (three comparators).
- Note: items/risks/decisions otherwise render in DB insertion order — out of scope
  here unless the same "weird order" complaint extends to them (confirm with the
  stakeholder before widening).
