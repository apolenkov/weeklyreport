# Tasks

- [x] 1. In `sdlc-pipeline.tsx` (and the grid feed in `mappers/lead-form.ts` /
      `lead-cross-author.ts`), filter the rendered stage chips by mode: Mine →
      only `ownership: "mine"`; Everyone → own + foreign-owned (locked) + vacant.
- [x] 2. Reflow the grid to the visible chips (no fixed seven-slot assumption);
      keep chip sizing/height consistent with the existing layout.
- [x] 3. When a product has zero own stages in Mine mode, render the product
      card with its health and a brief "No stages assigned to you" note instead
      of an empty grid.
- [x] 4. Verify health (left edge) severity and own-input completeness are
      unchanged by chip hiding — both derive from risks/status + owned-stage set,
      not from rendered chips. Add/adjust a test proving health stays honest when
      a covering foreign chip is hidden in Mine.
- [x] 5. Add a `TODO(why-status)` near the chip tooltip composition in
      `stage-chip.tsx` for the deferred risk-attribution explanation (no UI built
      now).
- [x] 6. Update pipeline tests and snapshots that assume a fixed seven-chip
      grid; add tests for Mine-only-own, Everyone-reveals, and no-own-stages.
- [x] 7. Gates green (typecheck/lint/test). Live-verify at 1200px on the
      enriched small seed: Mine shows only own stages; Everyone reveals
      foreign/vacant; health unchanged across the toggle.
