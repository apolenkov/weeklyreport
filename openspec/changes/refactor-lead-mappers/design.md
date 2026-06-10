# Design — Extract Lead-Form Cross-Author and Snapshot Mappers

## Context

Verified at HEAD 85541470 (2026-06-10): `lead-form.tsx` is 1936 LOC.
The derivation blocks to extract, with their current anchors:

- `:748-793` `_crossAuthorStageMap` build (joins `crossAuthorsQ` ×
  `crossAuthorSectionsQ` by `authorId`, keys via `normalizeStageName`,
  status via `deriveEffectiveStageStatus`).
- `:794-811` products overlay — rewrites ONLY `ownership ===
"unassigned"` stages to `"locked"` with assignee + status.
- `:815-865` `snapshotStageMap` IIFE (from `getVersionQ.data`;
  attaches risks/items only when `stageName` is present).
- `:869-898` `displayProducts` overlay — SKIPS `ownership ===
"locked"` stages; `trafficToStageStatus` then
  `deriveEffectiveStageStatus`.
- `:901` `productNameById` — built from `displayProducts`, i.e. AFTER
  both overlays.
- `:904-1019` `SnapPayload` type, `snapWorkflowToStatus` (`:931-937`),
  four snapshot projections with `snap:cw:`/`snap:nw:` index ids and
  `priorityRank` null-coalescing.
- `:1022-1107` four foreign projections (`foreign:<authorId>:<id>`
  ids; two byte-identical workflow ternaries; `stageIds: i.stageNames`;
  `productName` fallback to `projectId`; risk severity coerced to
  `"at-risk"` unless `"blocked"`; decision `deadline` →
  `toISOString().slice(0, 10)` or null passthrough).
- `:1109-1112` merges (own + foreign arrays) — untouched.

## Before/After Derivation Order

The order is IDENTICAL before and after — this change is extraction,
never reordering:

```text
data.products
  → cross-author overlay  (applyCrossAuthorStageOverrides)
  → snapshot overlay      (applySnapshotStageOverrides) = displayProducts
  → productNameById       (from displayProducts — after BOTH overlays)
  → projections           (snapshot snap:* and foreign foreign:*)
  → merges                (own + foreign, :1109-1112, untouched)
```

After the swap, each block becomes a plain pure-function call at the
same position. All derivations stay AFTER the early-return guard; no
`useMemo`/hooks are introduced (React Compiler manages memoization;
hook order must not change).

## Decisions

### D1 — Exactly two new mapper files, grouped by data source

`lead-cross-author.ts` (consumes the two cross-author queries) and
`lead-snapshot.ts` (consumes the `getVersion` payload), each under the
300-line budget. Not one file (mixes unrelated inputs); not three (the
stage map and foreign projections share input types and join helpers).

### D2 — Type ownership: structural inputs, Lead\*-extending outputs

`lib/mappers` MUST NOT import from `components/lead/mock-data.ts`
(layering inversion: lib → components). Input types are declared
locally as structural mirrors of the consumed query-row subset.
Output types extend the existing `Lead*` types from `./lead-form`
(e.g. `LeadKanbanItem & { foreign: true; authorId: string;
priorityRank?: number | null }`). `lead-snapshot.ts` owns the
`SnapPayload` structural type. `lead-form.tsx` keeps its existing
cast-to-mock-data pattern at the call sites; unifying the twin type
families is deferred (see proposal non-goals).

### D3 — One lenient workflow-coercion helper

`coerceWorkflowToItemStatus(ws: string)` exported from
`lead-cross-author.ts`, reused by `lead-snapshot.ts`: delegates the
three known enum values to the tested `workflowToItemStatus` and
returns `"planned"` for anything else. This preserves today's exact
semantics of all three inline copies. Substituting strict
`workflowToItemStatus` or `deriveItemStatus` would be a SILENT
BEHAVIOR CHANGE (`workflowStatus` is a plain string in the
cross-author rows; the `"planned"` fallback is load-bearing).
`item-status.ts` stays read-only in this slice to keep the touched
surface minimal; relocating the helper there can ride a later change.

### D4 — Snapshot null-payload invariant is encoded, not incidental

In snapshot mode (`viewedSnapshotVersion !== null`) with a null
payload (still loading, or no data for the version), all four
projections return `[]` — they NEVER fall back to the current draft.
`lead-snapshot.ts` encodes this rule and its unit test pins it. This
implements the `lead-report-controls-integrity` requirement added by
this change's spec delta (snapshot view never misrepresents historical
state).

### D5 — Acceptance contract: characterization suites + spec scenarios

Behavior preservation is proven by existing suites passing UNMODIFIED
(never regenerate snapshots, never relax asserts):
`lead-form-viewmode.snapshot.test.tsx` (the explicit pre-extract
snapshot suite), `lead-form.test.tsx` (mutation wiring, version
arrows, read-only versions), `lead-form-sync-bridge.test.tsx`
(displayRisks-vs-risks contract), `lead-form-addressable.test.tsx`,
`sdlc-pipeline.test.tsx`, `risks-section.snapshot.test.tsx`,
`decisions-section.snapshot.test.tsx`. From
`lead-report-controls-integrity`, the scenarios acting as the
behavioral acceptance contract are: "returning from a snapshot" (the
swap must not perturb the add-signal reset wiring at `:1593-1599`) and
the new "snapshot payload not yet loaded" scenario (D4). Per the
driver-verify lesson, sign-off additionally requires a live-browser
smoke of snapshot navigation and cross-author chips.

**Unit-test contract for the new modules.** Fixtures are transcribed
from the current inline logic's outputs, not idealized expectations —
the tests pin today's behavior, byte for byte.

`lead-cross-author.test.ts` pins:

- `mapForeignItems('current')` and `('next')` produce identical shapes
  differing only by the type filter.
- Workflow mapping equals `workflowToItemStatus` for
  `done`/`in_progress`/`blocked` and yields `'planned'` for anything
  else (the `coerceWorkflowToItemStatus` contract, D3).
- Item ids are `foreign:<authorId>:<itemId>`.
- `productName` falls back to `projectId` when `nameById` misses.
- Risk severity coerces every non-`'blocked'` value to `'at-risk'`.
- Decision `deadline`: `Date` → `'yyyy-mm-dd'` string; null passes
  through.
- `buildCrossAuthorStageMap` joins `crossAuthors` ×
  `crossAuthorSections` by `authorId`, keys via `normalizeStageName`,
  and derives status via `deriveEffectiveStageStatus(stageEntry,
stageRisks, stageItems)`.
- `applyCrossAuthorStageOverrides` rewrites ONLY
  `ownership === 'unassigned'` stages to `'locked'` with
  assignee + status.

`lead-snapshot.test.ts` pins:

- `buildSnapshotStageMap` attaches risks/items only when `stageName`
  is present and the stage entry exists.
- `applySnapshotStageOverrides` skips `ownership === 'locked'` stages
  and derives via `trafficToStageStatus` +
  `deriveEffectiveStageStatus`.
- `mapSnapshotItems` filters by type with `snap:cw:`/`snap:nw:` index
  ids and `priorityRank` null-coalescing.
- In snap mode with a null payload all four projections return `[]`
  (never the current draft) — the `lead-report-controls-integrity`
  acceptance hook (D4).

## Invariants Touched

- `lead-report-controls-integrity` — preserved, and the snapshot
  empty-array rule is promoted from code comment to spec requirement.
- Period dual-state, role-coverage gate, destructive-db guard,
  deferred-feature pattern — untouched (no API, schema, or DB work).

## Risks / Trade-offs

- [Revert-bait history] a prior mechanical refactor here passed
  typecheck/lint/test/build yet broke behavior → ALL edits sequential,
  single-writer, one commit each with the full gate run; parallel
  agents only for read-only analysis.
- [Semantics traps] (a) the `"planned"` fallback (D3); (b) foreign
  items emit `stageIds: i.stageNames` while snapshot items emit
  `stageName` — the asymmetry is load-bearing for stage-chip matching;
  (c) `productNameById` must derive from `displayProducts` AFTER both
  overlays; (d) cross-author overlay touches only `"unassigned"`
  stages while snapshot overlay skips `"locked"` — inverting either
  check corrupts chip ownership.
- [React Compiler] extracted module-level pure functions are
  compiler-neutral; converting derivations to hooks is not.
- [Surface heat] two active changes edit the same surface today →
  hard sequencing gate in the proposal; re-check line anchors when the
  gate opens.
