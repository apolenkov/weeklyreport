# Tasks — Require an SDLC Stage on Every Risk

Decisions D1-D4: `design.md`. Evidence anchors: `proposal.md`.
Implemented 2026-06-11 (user rule: «стадия должна быть всегда»).

## 1. Write contract (D1, D4)

- [x] 1.1 `packages/shared/src/schemas/section.schema.ts`:
      `riskInputSchema.stageIds` → risk-specific
      `z.array(z.string()).min(1).max(20)`; items/decisions keep
      `stageIdsField`.
      Implementation note: `requiredStageIdsField` added next to
      `stageIdsField` in `report-primitives.schema.ts`. The READ model
      (`reportSectionReadModelSchema.risks`) keeps a tolerant variant
      (`riskInputSchema.extend({ stageIds: stageIdsField })`) — required
      by the D2 spec scenario: a stage-less legacy row must still LOAD
      so the card can render the loud warning instead of crashing the
      read path (`reportSectionReadModelSchema.parse` runs in the API
      repository/service on every read).
- [x] 1.2 Unit test: schema rejects missing/empty `stageIds` on risks,
      still accepts them on items and decisions.
      Added Group 3b in `packages/shared/src/schemas/report.test.ts`
      (+ a read-model tolerance pin and a service-level rejection pin in
      `apps/api/.../report-sections.contract.test.ts`).

## 2. Display (D2)

- [x] 2.1 `risks-section.tsx`: drop the "All stages" label for risks;
      render a "No stage set" warning chip (existing warning tokens,
      neutral copy for read-only cross-author rows).
      Implementation note: `MetaRow` gained an opt-in
      `emptyStageChip="no-stage-warning"` preset (amber #fef3c7/#8a6d1b,
      same tokens as the F4 needsStage hint); items/decisions keep the
      default "All stages" chip. The delete-confirm subtitle's
      "all stages" copy switched to "no stage set" as well.
- [x] 2.2 Unit test: empty-stages row → warning chip, no "All stages";
      populated row → stage chips unchanged.
      `risks-section.test.tsx` + `risks-section.snapshot.test.tsx`
      updated to the new contract; legacy `stageName` fallback pinned.

## 3. Data (D3)

- [x] 3.1 `prisma/seed-simple.ts` (and `seed.ts` if it seeds risks):
      write explicit `stageIds` on every seeded risk.
      Verified already true: all 6 `risk.create` sites in
      `seed-simple.ts` and all 5 seed risks in `seed.ts` write a
      non-empty `stageNames` (the DB column behind read-model
      `stageIds`). The proposal's "seeds never write stageIds" claim
      was stale — no edit needed.
- [x] 3.2 Backfill script/path: `stageIds = splitStageNames(stageName)`
      where `stageIds` is empty and legacy `stageName` is set; run on
      dev/UAT (disposable DBs — reseed is acceptable instead).
      Verified instead of scripted: the DB has no legacy `stageName`
      column (only `stageNames String[]` — nothing to map from), and
      `customreport_dev` holds 0 stage-less risks out of 8
      (`stageNames: { isEmpty: true }` count). No UAT database exists
      on this host; `customreport_test` is rebuilt per test run.

## 4. Verification

- [x] 4.1 Dialog contract pin test: saving without a stage stays
      blocked ("Select at least one stage.").
      Already pinned by two existing tests in
      `risk-edit-dialog.test.tsx` ("starts with empty stage selection…"
      and "does NOT pre-select stages…") — both assert the blocked save
      and the error copy; both pass.
- [x] 4.2 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm
build` — record results here.
      2026-06-11 results: typecheck PASS, lint PASS (eslint + stylelint + prisma tsc), test PASS (shared 16 files / api 80 / web 113),
      build PASS.
- [x] 4.3 Live check: seeded risk cards show concrete stages (no
      "All stages" anywhere on the lead page); user acceptance.
      Live-checked on the production build (temporary `next start`
      on :3010 — the running dev server serves a stale corrupted
      webpack chunk for `/lead/report/[reportId]`, pre-existing infra
      issue, needs a dev-server restart): lead page as Boris renders
      7 risk cards, stage labels Planning/Development/Analysis/Design,
      0 × "All stages", 0 × "No stage set". User acceptance pending —
      morning review.
