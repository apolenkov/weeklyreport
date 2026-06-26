# Tasks — unassigned-stage-reporting-exclusion

## 1. Read model: per-product assigned-stage set (→ "Unassigned stages are excluded")

- [x] 1.1 In the lead read model (`apps/api/src/modules/report-sections/`
      `report-sections.prisma-repository.ts` + the read-model schema in
      `packages/shared` `section.schema.ts`), add a per-product `stageSet`: the
      stage ids with an assignment to ANY lead on the product. Assignment-driven
      only — NO union with risk- or status-referenced stages.
- [x] 1.2 Keep `ownedStages` as-is (the current author's stages). `stageSet` is
      READ-ONLY display metadata, additive, and MUST NOT feed the write path —
      `saveSection` keeps persisting `StageStatus` only from `ownedStages`.
- [x] 1.3 Confirm published-snapshot reads are untouched (frozen snapshot path
      does not recompute `stageSet`).

## 2. Web grid built from the stage set (→ same requirement)

- [x] 2.1 `apps/web/src/lib/mappers/lead-form.ts` `buildStageGrid`: iterate the
      product's `stageSet`, NOT all seven `STAGE_NAMES`. A set stage owned by the
      lead → `mine`; in the set but not owned → foreign-owned; not in the set →
      omitted entirely. Stop emitting `ownership:"unassigned"` chips.
- [x] 2.2 `apps/web/src/lib/mappers/lead-cross-author.ts`
      `applyCrossAuthorStageOverrides`: foreign-owned stages are now created from
      the stage-set membership, not upgraded from a pre-existing `"unassigned"`
      chip. Reconcile with the cross-author owner/status data.
- [x] 2.3 Retire the `"unassigned"` render path in
      `sdlc-pipeline.tsx`, `sdlc-hidden-stages.ts`, `sdlc-collapsed-indicator.tsx`,
      `stage-chip.tsx`. Consider dropping `"unassigned"` from
      `LeadStageOwnership` (`lead-form.ts:77` + mirror in `mock-data.ts`).

## 3. Collapsed indicator + reveal (→ MODIFIED collapsed-indicator requirements)

- [x] 3.1 The Mine-mode collapsed indicator now reveals only foreign-owned
      hidden stages — no "unassigned" rows (unassigned stages are excluded from
      the set). Update the reveal lines (`sdlc-hidden-stages.ts`) and the
      grey-from-unassigned severity path.
- [x] 3.2 The `+N more` per-row color uses `empty` (owned-but-unstatused) for the
      muted treatment; the "unassigned" muted case is gone.

## 4. No-number-change + write-path guards (→ "Unassigned stages are excluded")

- [x] 4.1 Regression: excluding an unassigned stage changes NO product-health,
      severity, or completeness number versus before (assert equality on a
      fixture with a vacant stage). A risk on a vacant stage still lists in the
      risk section; the product is never red with zero visible explanation.
- [x] 4.2 Write-path guard: a non-owned `stageSet` chip (foreign-owned, shown
      read-only) cannot be persisted as the lead's status — `saveSection` /
      submit writes statuses only for `ownedStages`. Add a save/submit regression
      proving an unowned stageSet stage never reaches `StageStatus` for that lead.

## 5. Spec amendments already in this change's delta

- [x] 5.1 `lead-pipeline-card` delta authored (ADD exclusion rule + MODIFY the
      four vacant-rendering requirements). Re-run `openspec validate
    unassigned-stage-reporting-exclusion --strict`.

## 6. Tests + gates

- [x] 6.1 Mapper test: a product whose `stageSet` omits a stage renders no chip
      for it (Mine and Everyone); a foreign-owned stage renders locked in
      Everyone; a risk-named UNASSIGNED stage stays excluded while its risk row
      stays listed in the risk section.
- [x] 6.2 Pipeline component test: no "unassigned" chips anywhere; collapsed
      indicator reveals only foreign-owned hidden stages; health + completeness
      numbers unchanged vs before (regression assertion).
- [x] 6.3 Confirm slides / head portfolio `stageCount` unchanged (already
      assignment-scoped) — add a guard assertion if cheap.
- [x] 6.4 `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
