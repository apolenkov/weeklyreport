# Tasks — Product Pick Auto-Fits the Lead Slide

Decisions D1-D4: `design.md`. Open questions 1-5: `proposal.md` —
conservative defaults are implementable without re-asking; confirm
with the user at live-check (4.3).
NOT STARTED — captured 2026-06-11 from user feedback
(«авто-выравнивание по всему слайду»).

## 1. Model (D2)

- [ ] 1.1 `section-slide-utils.ts`: pure
      `scopeSlideToProduct(slide, productId)` — `null` returns the
      slide unchanged; a product id reduces `productSlides` to that
      product and drops the `cross-product` pseudo-entry.
- [ ] 1.2 Unit tests: null passthrough; single-product scoping;
      cross-product exclusion; unknown id yields empty `productSlides`
      (renders as all-empty quadrants, no crash).

## 2. Web — chip wiring (D1, D4)

- [ ] 2.1 `status-slide-deck.tsx` `LeadSlideArticle`: local
      `activeProductId` state; pass `activeProductId` + toggle
      `onSelect` to `SlideProductChips`; feed
      `scopeSlideToProduct(slide, activeProductId)` into
      `buildUnifiedSlideModel`; reset selection on slide page change.
- [ ] 2.2 Component tests: chip click filters rows and sets
      `aria-selected`; second click restores all products; page change
      clears the filter.

## 3. Web — frame fill (D3)

- [ ] 3.1 `LeadSlideArticle` + `lead-unified-slide.tsx`: column layout
      inside `.slide-frame` (`flex h-full flex-col`; grid `flex-1
    min-h-0`); the `52dvh` floor stops sizing the framed surface;
      keep the `--slide-quadrant-min` floor and fullscreen behavior.
- [ ] 3.2 Update `status-slide-deck` snapshots to the new contract
      (do NOT touch the pre-existing uncommitted
      `product-accordion.test.tsx.snap` modification).

## 4. Verification

- [ ] 4.1 `npx openspec validate slides-product-autofit`.
- [ ] 4.2 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm
    build` — record results here.
- [ ] 4.3 Live check on `/lead/report/<id>?mode=slides` with a
      multi-product seeded section: pick → fill, unpick → fill, add a
      theme → same rebalance; walk the proposal's open questions with
      the user and record their answers.
