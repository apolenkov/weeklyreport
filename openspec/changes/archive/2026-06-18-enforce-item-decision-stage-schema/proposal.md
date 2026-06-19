# Enforce a concrete SDLC stage on items and decisions at the schema layer

## Why

`require-stage-on-items-and-decisions` closed the dialog-layer gap: a lead can no
longer save a stage-less item or decision through the edit dialog. But it left the
server-side parity as an explicit, documented follow-up. Today `itemInputSchema`
and `decisionInputSchema` still use the lenient `stageIdsField` (empty allowed),
so a direct API caller — or a stale client — can still persist a stage-less item
or decision. Risks already reject this at the write layer via `requiredStageIdsField`.

This change finishes the job: it tightens the item and decision write schemas to
match the risk write schema, and it makes stage-less legacy item/decision rows
render the same loud "No stage set" marker that risk rows already show, instead of
the disguised "All stages" / "all stages" label.

## What Changes

- In `packages/shared/src/schemas/section.schema.ts`, change
  `itemInputSchema.stageIds` and `decisionInputSchema.stageIds` from
  `stageIdsField` to `requiredStageIdsField` (mirroring `riskInputSchema`). This is
  BREAKING for any API caller that submits a stage-less item or decision.
- Add `itemReadModelSchema` and `decisionReadModelSchema` that re-loosen `stageIds`
  back to `stageIdsField`, and swap them into `reportSectionReadModelSchema` in
  place of the raw input schemas — exactly as `riskReadModelSchema` already does
  for risks. Without this, stage-less legacy item/decision rows would fail to parse
  on READ and could not render their warning marker.
- Replace the disguised "All stages" (item card) and "all stages" (decision row)
  empty-selection labels with the loud "No stage set" warning marker, using the
  same warning tokens as the risk row.

## Out of scope

- The dialog-layer rule and `StageMultiSelect` helper copy — already shipped in
  `require-stage-on-items-and-decisions`.
- Renaming `stageIds` → `stageNames` (tracked separately as `TODO(STAGE-NAMING-01)`).
- Any backfill or alter-table migration. There is no legacy `stageName` column to
  backfill; the read model simply tolerates empty `stageIds` until a lead resaves.

## Impact

- Affected specs: MODIFIED requirements in `risk-stage-integrity` (schema-level
  enforcement and the loud marker now cover items and decisions, not only risks).
- Affected code:
  - `packages/shared/src/schemas/section.schema.ts` — tighten the two input
    schemas, add the two read-model schemas, rewire `reportSectionReadModelSchema`.
  - `apps/web/src/components/lead/item-card.tsx` — "No stage set" marker.
  - `apps/web/src/components/lead/decisions-section.tsx` — "No stage set" marker.
  - `prisma/seed-demo.ts` — both tiers (`SMALL_DATASET` items/decisions and
    `buildHugeDataset`) must carry explicit stages on every item and decision.
  - Test fixtures and write-path factories that submit stage-less items/decisions.
- Ordering: this change must land AFTER `require-stage-on-items-and-decisions`.
