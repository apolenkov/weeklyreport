# Tasks

## 1. Web — subgrid alignment (apps/web)

- [x] 1.1 In `slides/lead-product-grid.tsx`, give the outer grid row tracks and
      make each `ProductCard` a subgrid participant: `display: grid;
grid-row: span 4; grid-template-rows: subgrid` (Tailwind
      `row-span-4 grid grid-rows-subgrid`) over the four bands (header / Current
      / Next / Risks+Decisions). Replaced the card's `flex h-full flex-col`.
      NOTE: the outer grid needs no explicit `grid-template-rows` — the four
      implicit auto-row tracks created by each `row-span-4` card are shared by
      same-row cards (canonical subgrid card pattern). Gap split to
      `gap-x-4 gap-y-3` on the parent + `gap-3` on the card so band spacing is
      ~0.75rem under either subgrid-gap interpretation.
- [x] 1.2 Always render ALL FOUR bands: dropped the conditional
      `hasRisks || hasDecisions` wrapper and the `mt-auto` pin; an absent
      Risks+Decisions band renders a quiet "No risks or decisions" placeholder
      so the band keeps its track.
- [x] 1.3 Keep `MAX_VISIBLE_ITEMS` truncation and the "+N more" rows unchanged
      (they bound each band's height).

## 2. Tests (apps/web)

- [x] 2.1 jsdom: render `LeadProductGrid` with products of UNEVEN section sizes;
      assert every card renders all four bands (incl. an empty Risks+Decisions
      placeholder), the card uses the subgrid row template (`row-span-4` +
      `grid-rows-subgrid` class assertion), and no card uses `mt-auto`/`h-full`.
      (jsdom has no layout engine, so true horizontal alignment is proven only
      by the live check 4.2 — the class assertions are the regression teeth.)
- [x] 2.2 Assert the "+N more" truncation still appears for a band over
      `MAX_VISIBLE_ITEMS` (added a decisions-band over-cap test alongside the
      existing risks one).

## 3. Docs & specs

- [x] 3.1 `lead-product-grid-alignment` capability delta (this change).

## 4. Verification

- [x] 4.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
      (combined gate across all five changes — see the implementation branch).
- [ ] 4.2 Live: in PRODUCT scope with 3 products of different content volumes, the
      Current / Next / Risks+Decisions bands line up horizontally across the cards
      (nothing floats); empty bands hold their place. (Live-verify phase — see
      handoff.)
- [x] 4.3 `openspec validate fix-lead-product-grid-card-alignment --strict`.
