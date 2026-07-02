## 0. Decision (confirm before coding)

- [x] 0.1 Ordering scope within a quadrant: **per-product-block** (consistent with the product-grouped idiom across accordion + slides) vs global-within-quadrant. Confirmed per-product-block (decisions-locked-2026-06-30 §C4).

## 1. Fix

- [x] 1.1 In `buildUnifiedSlideModel` (`apps/web/src/components/slides/section-slide-utils.ts`), sort the Current and Next rows by `priorityRank` ascending, nulls-last, stable — reusing the `sortByPriority` comparator, extracted to the shared `apps/web/src/lib/priority-sort.ts` (`sortByPriorityRank`) and adopted by both `product-accordion.tsx` and the slide builder.
- [x] 1.2 Applied within the per-product block (each product's rows are mapped, sorted, then pushed contiguously); no reorder across `paginateSectionSlides` chunks or across products.
- [x] 1.3 Deleted the three pre-filtered `?? 0` sorts on the `priorities` arrays (the misleading part — they imply an ordering that is never rendered). **Deviation from "delete priorities[]":** the `priorities` arrays are KEPT — they feed `priorityCount` → readiness (order-independent `.length`), so removing them breaks the readiness checklist. The built-but-unrendered `UnifiedSlideModel.priorities` quadrant is left inert (a separate order-neutral cleanup; removing it churns the model interface + two test constructors for zero behavior change).

## 2. Tests

- [x] 2.1 Added unit tests over `buildUnifiedSlideModel`: ranked items lead in ascending rank, unranked follow in source order, on both the lead (`buildSectionSlideModel`) and head (`buildProductScopedSlides`) model paths.
- [x] 2.2 Added a duplicate-rank case (two items rank 2) — they render adjacently, stable.
- [x] 2.3 Added a per-product-block regression test (a name-later product's P1 stays behind a name-earlier product's rows — a global sort would fail it). No existing snapshot locked the old insertion order (full slide suite green unchanged).
- [x] 2.4 `apps/web/src/lib/priority-sort.test.ts` covers the shared comparator (ascending, nulls-last, stable, non-mutating).

## 3. Verification

- [x] 3.1 `pnpm typecheck` and `pnpm lint` green.
- [x] 3.2 `pnpm exec vitest run` for the slide-model + priority-sort tests green (full web unit suite 1381 pass).
- [x] 3.3 `openspec validate "fix-slide-priority-ordering" --strict` exits 0.
