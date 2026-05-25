# Tasks

- [ ] T1: Audit separator rendering — inspect
      `apps/web/src/components/slides/status-slide-deck.tsx` and identify all
      product separator placement logic
- [ ] T2: Identify inconsistency source — check whether it's margin inheritance,
      grid row position, or parent container sizing
- [ ] T3: Unify positioning — apply consistent margin-top or grid-row-start
      across all separator instances
- [ ] T4: Test multi-product alignment — render slides with 3+ products,
      verify separators align vertically
- [ ] T5: Visual regression check — take slide screenshots, compare before/after
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint` pass; manual visual
      spot-check
