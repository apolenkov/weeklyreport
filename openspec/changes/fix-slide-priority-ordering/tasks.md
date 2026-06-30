## 0. Decision (confirm before coding)

- [ ] 0.1 Ordering scope within a quadrant: **per-product-block** (default — consistent with the product-grouped idiom across accordion + slides) vs global-within-quadrant (cleaner P1→Pn column). Confirm with Саша; default per-product-block.

## 1. Fix

- [ ] 1.1 In `buildUnifiedSlideModel` (`apps/web/src/components/slides/section-slide-utils.ts:656`), sort the Current and Next rows by `priorityRank` ascending, nulls-last, stable — reusing the `product-accordion.tsx:101` `sortByPriority` comparator (extract/share it).
- [ ] 1.2 Apply within the chosen scope (§0.1); do not reorder across `paginateSectionSlides` chunks.
- [ ] 1.3 Delete the dead `priorities[]` array and the three pre-filtered `?? 0` sorts (`:188/:261/:292`) — unrendered and misleading.

## 2. Tests

- [ ] 2.1 Add a unit/snapshot test over `buildUnifiedSlideModel`: ranked items lead in ascending rank, unranked follow in source order, on both lead and head model paths.
- [ ] 2.2 Add a duplicate-rank case (two items rank 2) — they render adjacently, ranks unchanged.
- [ ] 2.3 Update any existing slide snapshots that locked the old insertion order.

## 3. Verification

- [ ] 3.1 `pnpm typecheck` and `pnpm lint` until green.
- [ ] 3.2 `cd apps/web && pnpm exec vitest run` for the slide-model tests until green.
- [ ] 3.3 `openspec validate "fix-slide-priority-ordering" --strict` until it exits 0.
