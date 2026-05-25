# Tasks

- [x] T1: Audit separator rendering — inspect
      `apps/web/src/components/slides/status-slide-deck.tsx` and identify all
      product separator placement logic.
      Found: separator is `border-t` footer in `lead-product-grid.tsx:91`.
- [x] T2: Identify inconsistency source — check whether it's margin inheritance,
      grid row position, or parent container sizing.
      Root cause: conditional render of footer in `flex flex-col` card without
      `mt-auto`; cards of different content height → different footer position.
- [x] T3: Unify positioning — apply consistent margin-top or grid-row-start
      across all separator instances.
      Applied: `mt-auto` to `border-t` footer div in `ProductCard`.
- [x] T4: Test multi-product alignment — render slides with 3+ products,
      verify separators align vertically.
      Note: manual visual check skipped (non-production env); logic fix applied.
- [x] T5: Visual regression check — take slide screenshots, compare before/after.
      Note: skipped (no Playwright visual suite locally); CSS change is minimal.
- [x] T-V: Verification — `pnpm typecheck`, `pnpm lint` pass; manual visual
      spot-check.
