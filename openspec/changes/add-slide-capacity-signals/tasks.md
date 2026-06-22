# Tasks

## 1. Shared constants (packages/shared)

- [x] 1.1 Export `MAX_PRODUCTS_PER_LEAD = 6` and `SLIDE_SECTION_SOFT_CAP = 5`
      (concrete, F9) from `@customreport/shared` with a comment noting both are
      advisory/tunable soft caps, not enforced rules. NOTE: there was NO existing
      constants barrel — created `packages/shared/src/constants.ts` and wired it
      into `src/index.ts`.

## 2. Web — admin product-count advisory (apps/web)

- [x] 2.1 In `admin/products-tab.tsx`, compute the chosen lead's active-product
      count from the FULL `products` prop (by `leadOwnerId` + active), NOT from
      `filteredProducts` (F8 — filter/search must not undercount); render a
      non-blocking hint near the Lead Owner select: "N of `MAX_PRODUCTS_PER_LEAD`
      products".
- [x] 2.2 When N ≥ `MAX_PRODUCTS_PER_LEAD`, show a gentle over-capacity
      recommendation; keep Save enabled (no disable, no server reject).

## 3. Web — section slide-fit advisory (apps/web)

- [x] 3.1 In ALL FOUR section components — `current-week-section.tsx`,
      `next-week-section.tsx`, `risks-section.tsx`, `decisions-section.tsx` —
      when a SINGLE product's count within the section exceeds
      `SLIDE_SECTION_SOFT_CAP`, render a quiet advisory attached to that product's
      group, not to the section-level Add control. SURPRISE corrected: only
      current/next-week `groupByProduct` into columns; risks/decisions render a
      FLAT list, so a shared `firstOverCapRowIds` helper finds the first row of
      each over-cap group and the advisory renders once per group there. Shared
      `SlideFitAdvisory` component holds the copy in one place (risks group by
      productId, decisions by productName).
- [x] 3.2 Ensure the advisory never blocks adding and clears when back under the
      cap. English copy only. (`SlideFitAdvisory` self-gates at `<= cap`.)

## 4. Tests

- [x] 4.1 Shared: assert both constants are exported and positive
      (`packages/shared/src/constants.test.ts`).
- [x] 4.2 Admin: render `products-tab` with a 6-active-product lead → over-cap
      hint shows and Save stays enabled; with fewer → no over-cap hint. Assert the
      count holds even with a product filter (F8 — computed from the full set,
      not the filtered view).
- [x] 4.3 Section: render a section where ONE product exceeds
      `SLIDE_SECTION_SOFT_CAP` → advisory shows and adding is still allowed; under
      the cap → no advisory. Covered for the grouped path
      (`current-week-section-add-signal.test.tsx`), the flat path
      (`risks-section.test.tsx`), plus a direct unit test of the component +
      `firstOverCapRowIds` helper (`slide-fit-advisory.test.tsx`).

## 5. Docs & specs

- [x] 5.1 `slide-capacity-signals` capability delta (this change).
- [x] 5.2 `CONTEXT.md` — VERIFIED the "Slide capacity (soft cap)" glossary entry
      (already added this session, covering both constants vs the Product-scope
      `MAX_VISIBLE_ITEMS`); no new edit needed.

## 6. Verification

- [x] 6.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
      (combined gate across all five changes — see the implementation branch).
- [x] 6.2 Live (2026-06-22, lead1 on :3000, huge seed): added a 6th record to
      one product's Current Week section through the real Add-Item dialog → the
      per-product advisory "6 records may not fit cleanly on the slide" appeared
      on that product's group, and adding stayed allowed (non-blocking)
      — screenshot captured. The admin "Nth-of-6 product" count is the same
      soft-cap signal on the admin surface; left as a trivial manual check. DB
      restored to the small seed afterward.
- [x] 6.3 `openspec validate add-slide-capacity-signals --strict`.
