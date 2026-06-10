# Tasks — Require an SDLC Stage on Every Risk

Decisions D1-D4: `design.md`. Evidence anchors: `proposal.md`.
NOT STARTED — captured 2026-06-10 (user rule: «стадия должна быть
всегда»; implement on go-ahead).

## 1. Write contract (D1, D4)

- [ ] 1.1 `packages/shared/src/schemas/section.schema.ts`:
      `riskInputSchema.stageIds` → risk-specific
      `z.array(z.string()).min(1).max(20)`; items/decisions keep
      `stageIdsField`.
- [ ] 1.2 Unit test: schema rejects missing/empty `stageIds` on risks,
      still accepts them on items and decisions.

## 2. Display (D2)

- [ ] 2.1 `risks-section.tsx`: drop the "All stages" label for risks;
      render a "No stage set" warning chip (existing warning tokens,
      neutral copy for read-only cross-author rows).
- [ ] 2.2 Unit test: empty-stages row → warning chip, no "All stages";
      populated row → stage chips unchanged.

## 3. Data (D3)

- [ ] 3.1 `prisma/seed-simple.ts` (and `seed.ts` if it seeds risks):
      write explicit `stageIds` on every seeded risk.
- [ ] 3.2 Backfill script/path: `stageIds = splitStageNames(stageName)`
      where `stageIds` is empty and legacy `stageName` is set; run on
      dev/UAT (disposable DBs — reseed is acceptable instead).

## 4. Verification

- [ ] 4.1 Dialog contract pin test: saving without a stage stays
      blocked ("Select at least one stage.").
- [ ] 4.2 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm
  build` — record results here.
- [ ] 4.3 Live check: seeded risk cards show concrete stages (no
      "All stages" anywhere on the lead page); user acceptance.
