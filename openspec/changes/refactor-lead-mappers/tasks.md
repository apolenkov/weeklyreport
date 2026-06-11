# Tasks — Refactor Lead Mappers

NOT STARTED — captured 2026-06-10. Evidence anchors: `proposal.md`,
`design.md` (derivation order, type ownership, invariants). Line refs
verified at HEAD 85541470; re-verify before editing — the lead surface
is hot.

**Hard gate:** opens only after `fix-lead-stripe-and-archived-badges`
AND `require-risk-stage` are archived, and after
`hoist-query-error-policy` lands (see `proposal.md` Sequencing).

**Execution note (standing):** Sequential single-writer edits only;
parallel agents only for read-only analysis (repo lesson: parallel
mechanical edits pass gates but break behavior).

**Staging discipline:** a parallel session keeps a dirty working tree
in `apps/web`. Stage only the paths listed per task; never
`git add -A`. Re-run `git status` immediately before every commit.

**Characterization guards (must pass UNMODIFIED at every commit —
never regenerate snapshots to silence a diff):**
`lead-form.test.tsx`, `lead-form-viewmode.snapshot.test.tsx`
(explicit pre-extract snapshot suite), `lead-form-sync-bridge.test.tsx`
(displayRisks merged vs own-only sync contract),
`lead-form-addressable.test.tsx`, `sdlc-pipeline.test.tsx`,
`risks-section.snapshot.test.tsx`, `decisions-section.snapshot.test.tsx`.

## 1. web — additive mapper modules (no call-site change)

- [x] 1.1 Add `apps/web/src/lib/mappers/lead-cross-author.ts` +
      `lead-cross-author.test.ts`; export via `mappers/index.ts`.
      Port `lead-form.tsx:748-811` (stage-map build + product overlay)
      and `:1022-1107` (4 foreign projections) as pure functions:
      `buildCrossAuthorStageMap(crossAuthors, crossAuthorSections)`
      (join by authorId, `normalizeStageName` keys,
      `deriveEffectiveStageStatus(stageEntry, stageRisks, stageItems)`),
      `applyCrossAuthorStageOverrides(products, map)` (rewrite ONLY
      `ownership === 'unassigned'` stages to `'locked'` with
      assignee+status), `mapForeignItems(sections, nameById, type:
'current' | 'next')` deduplicating the byte-identical pair,
      `mapForeignRisks`, `mapForeignDecisions`. Replace the two inline
      workflow ternaries with the exported
      `coerceWorkflowToItemStatus(ws: string)` helper (design D3:
      delegates known enum values to `workflowToItemStatus`, explicit
      `'planned'` fallback), preserving exact semantics:
      `stageIds: i.stageNames` field choice, `foreign:<authorId>:<id>`
      id scheme, productName fallback to projectId, severity coercion
      (non-`'blocked'` → `'at-risk'`),
      `deadline.toISOString().slice(0, 10)` and null passthrough.
      Tests per the "Unit-test contract" in `design.md` D5. Commit is
      additive and green.
- [ ] 1.2 Add `apps/web/src/lib/mappers/lead-snapshot.ts` +
      `lead-snapshot.test.ts`; export via `mappers/index.ts`.
      Port as pure functions: `buildSnapshotStageMap(payload)` from
      `lead-form.tsx:815-865` (snapshot stage map:
      `normalizeStageName` keying, risks/items attach only when
      stageName present, missing-stageName skip),
      `applySnapshotStageOverrides(products, map)` from `:869-898`
      (own-stage override skipping `ownership === 'locked'`,
      `trafficToStageStatus` + `deriveEffectiveStageStatus`), and
      `mapSnapshotItems`/`mapSnapshotRisks`/`mapSnapshotDecisions(payload,
nameById, authorName)` from `:904-1019` (`SnapPayload` structural
      type, `snap:cw:`/`snap:nw:` index ids, priorityRank
      null-coalescing, `snapWorkflowToStatus` replaced by the shared
      `coerceWorkflowToItemStatus` imported from
      `lead-cross-author.ts`). Encode the invariant: in snap
      mode with a null payload ALL FOUR projections return `[]` —
      never the current draft (lead-report-controls-integrity
      acceptance hook). Tests per the "Unit-test contract" in
      `design.md` D5. Commit is additive and green.

## 2. web — swap call sites in lead-form.tsx (sequential)

- [ ] 2.1 Swap the cross-author call sites: replace inline blocks
      `:748-811` and `:1022-1107` with mapper calls; delete the inline
      loops and both inline ternaries. Preserve derivation order:
      `data.products` → `applyCrossAuthorStageOverrides` → snapshot
      overlay → `productNameById` from displayProducts → projections.
      Keep all derivations after the early returns, exactly where the
      inline code sits today. Characterization guards pass unmodified.
- [ ] 2.2 Swap the snapshot call sites: replace `:815-898` and
      `:904-1019` with mapper calls; delete `SnapPayload`,
      `snapWorkflowToStatus`, and both IIFEs from `lead-form.tsx`.
      Verify ~300 LOC net reduction (file lands near 1630). Same
      constraints; strictly after 2.1.

## 3. docs — backlog evidence + follow-up

- [ ] 3.1 The `specs/architecture-refactor-backlog/spec.md` delta in
      this change records the landed slice and refreshes the LOC
      figure — confirm the final number after 2.2 and adjust the delta
      before archive.
- [ ] 3.2 Recorded follow-up (non-goal here): twin presentation-type
      families in `mock-data.ts` vs `lib/mappers/lead-form.ts` (one
      proven drift instance) — fold into the next decomposition slice.

## Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green at
      EVERY commit (1.1, 1.2, 2.1, 2.2), not only at the end.
- [ ] Characterization suites listed above pass with zero snapshot
      regeneration.
- [ ] `grep -nE '[а-яА-Я]' <touched .tsx/.ts>` — matches are
      data/comments/tests only.
- [ ] Live smoke in the browser (driver-verify lesson — never trust
      suites alone on this surface): snapshot navigation
      (view snapshot → back to current), cross-author products render
      with stage overrides, foreign items/risks/decisions visible and
      read-only.
