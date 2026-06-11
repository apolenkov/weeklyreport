# Extract Lead-Form Cross-Author and Snapshot Mappers

## Why

`lead-form.tsx` is a 1936-line component. Four derivation blocks live
inline instead of in the `lib/mappers` seam where their tested siblings
(`mapLeadItems`/`mapLeadRisks`/`mapLeadDecisions`) already sit:
cross-author stage map + overlay (`:748-811`), snapshot stage map +
overlay (`:815-898`), snapshot projections (`:904-1019`), and four
foreign projections (`:1022-1107`) containing a byte-identical
current/next `.map()` pair. The lenient workflow→status mapping is
written three times in one file (`:931-937`, `:1032-1038`,
`:1057-1063`). A prior mechanical refactor of exactly this area passed
all gates yet broke behavior and was reverted — extraction must be
guarded by the existing characterization suites and sequential
single-writer commits.

Inventories: `apps/web/src/components/lead/lead-form.tsx`;
`apps/web/src/lib/mappers/` (`lead-form.ts`, `item-status.ts`,
`index.ts`); characterization suite
`lead-form-viewmode.snapshot.test.tsx` (labeled a pre-extract
snapshot); `openspec/specs/architecture-refactor-backlog/spec.md`
(lead-form decomposition target, gated behind a grilled change).

## What Changes

1. New `apps/web/src/lib/mappers/lead-cross-author.ts` + unit tests:
   stage-map build/overlay, the four foreign projections (current/next
   pair deduplicated), one lenient workflow-coercion helper.
2. New `apps/web/src/lib/mappers/lead-snapshot.ts` + unit tests:
   snapshot stage map/overlay, `snap:*` projections, and the
   null-payload ⇒ empty-arrays invariant.
3. Two swap commits in `lead-form.tsx` replacing the inline blocks
   with mapper calls (~300 LOC net reduction, file ≈1630).
4. Every existing lead suite passes UNMODIFIED; snapshot files are
   never regenerated.

This change ABSORBS the `cross-author-mappers` candidate: its refined
scope is a strict subset of this one — one change, never two.

**Non-goals:** NO ReportDataCoordinator/FormStateManager (stays
deferred in the backlog spec); NO query changes (the 7 queries at
`:312-379` untouched); NO type-tagged own/foreign split; NO
change-handler extraction; `enrichedCrossAuthors` (`:385-405`) stays
inline (its `CrossAuthorEntry` type lives in `sdlc-pipeline.tsx`;
relocation widens the blast radius); the twin presentation-type
families (`mock-data.ts` vs `lib/mappers/lead-form.ts`, incl. the
undeclared `priorityRank` on `LeadKanbanItem`) are a recorded
follow-up for a separate tiny change.

## Sequencing

Wave 2 — after `hoist-query-error-policy`; before
`refactor-lead-dialog-lifecycle`. Hard gate: opens only after the
active `fix-lead-stripe-and-archived-badges` AND `require-risk-stage`
are archived (same lead surface, single-writer rule). This change IS
the grilled artifact the `architecture-refactor-backlog` spec mandates
for the mappers slice.

## Capabilities

### Modified Capabilities

- `architecture-refactor-backlog`: record the first landed lead-form
  slice (mappers extraction) and refresh the LOC evidence; the
  decomposition target stays open.
- `lead-report-controls-integrity`: add the snapshot-fidelity
  requirement (null payload renders empty, never the draft) that the
  extracted snapshot mappers encode.

## Impact

- `apps/web/src/components/lead/lead-form.tsx` (swap commits only).
- `apps/web/src/lib/mappers/lead-cross-author.ts`, `lead-snapshot.ts`,
  their tests, `index.ts` barrel (new/extended).
- Read-only: `lib/mappers/lead-form.ts`, `item-status.ts`,
  `lib/stage-status.ts`.
