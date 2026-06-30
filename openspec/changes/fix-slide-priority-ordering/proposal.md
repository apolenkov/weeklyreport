## Why

> Captured from 2026-06-30 demo feedback (cluster C4), grilled + adversarially
> verified. See `docs/feedback/decisions-locked-2026-06-30.md`.

"Priorities look weird on the slide; they should be ordered." The grill found the
**handed-down root cause was a misread** — and the originally-proposed fix is a no-op:

1. The three flagged sort sites (`section-slide-utils.ts:188/261/292`) **pre-filter
   `priorityRank != null`** before the comparator, so the `?? 0` branch is dead; a
   nulls-last comparator there changes nothing.
2. The sorted `priorities[]` array those sites build is **rendered nowhere** on
   either deck (`lead-unified-slide.tsx:126` "built but not rendered").

The **actual visible bug:** priority items ride as `P{N}` chips on Current/Next
bullets (`lead-unified-slide.tsx:93`, `status-slide-deck.tsx:141`), and those
quadrants render in **insertion order** — so `P3` can sit above `P1`.

## What Changes

- In `buildUnifiedSlideModel` (`section-slide-utils.ts:656`) sort the **Current and
  Next** rows so priority-ranked items lead in ascending `priorityRank`, unranked
  items follow in source order (stable, nulls-last). Reuse the live reference
  comparator `product-accordion.tsx:101` `sortByPriority`. Both decks call this
  builder, so one change covers lead + head.
- Ordering is **best-effort** over possibly duplicate or gapped ranks
  (`priorityRank` is `min(1).nullable`, no uniqueness constraint) — it surfaces them
  adjacently, ascending; it does not renumber.
- **Exemplary cleanup:** delete the dead `priorities[]` array and the three dead
  `?? 0` sorts — they are unrendered and misleading.
- Add a TDD snapshot test locking the chosen order (current/next chips ascending by
  rank, unranked last).

## Capabilities

### New Capabilities

- `slide-priority-ordering`: the on-slide ordering rule for priority-ranked
  Current/Next items (no spec governed on-slide item ordering before — confirmed
  across the four slide specs).

### Modified Capabilities

- (none — additive ordering rule; the existing slide-layout specs keep their 2×2
  topology untouched, since the fix is "sort chips in place", not a new panel.)

## Impact

- `apps/web/src/components/slides/section-slide-utils.ts` (`buildUnifiedSlideModel`
  sort; delete dead `priorities[]` + the three `?? 0` sorts).
- Render-only — no write path, no invariant engaged (period-dual-state /
  role-coverage-gate / C1 review-acknowledgement untouched).
- Scope: ordering **within a rendered page/section**, not globally across
  `paginateSectionSlides` product chunks. Decision pending — see `tasks.md` §0.
