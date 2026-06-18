# Tasks

> Land this change AFTER `require-stage-on-items-and-decisions` (dialog layer).

## Prerequisite audit (DO THIS FIRST — or draft-save/submit will reject seeded data)

- [x] 1. Audit `prisma/seed-demo.ts` `SMALL_DATASET`: every seeded item and
     decision must set explicit `stages` / `stageNames`. The seed writes via the
     `stageNames` Prisma column (not the zod schema), so a stage-less seeded row
     loads fine but is rejected on the first submit/resave — fix the data, not
     the schema.
- [x] 2. Audit `prisma/seed-demo.ts` `buildHugeDataset()`: same — give every item
     and decision in the huge tier explicit stages.
- [x] 3. Grep test fixtures and write-path factories (anything that builds a
     `DraftSavePayload` / submit payload, or item/decision input objects) for
     empty/absent `stageIds` on items and decisions; give them explicit stages.
     Read-model fixtures do NOT need to change — the read-model split keeps
     stage-less rows parseable.

## Schema

- [x] 4. `packages/shared/src/schemas/section.schema.ts`: change
     `itemInputSchema.stageIds` and `decisionInputSchema.stageIds` from
     `stageIdsField` to `requiredStageIdsField`. Add a short comment mirroring the
     risk one noting this is BREAKING for stage-less API callers.
- [x] 5. Same file: add `itemReadModelSchema = itemInputSchema.extend({ stageIds:
stageIdsField })` and `decisionReadModelSchema = decisionInputSchema.extend({
stageIds: stageIdsField })`, mirroring `riskReadModelSchema`.
- [x] 6. Same file: in `reportSectionReadModelSchema`, swap `items:
z.array(itemInputSchema)` → `itemReadModelSchema` and `decisions:
z.array(decisionInputSchema)` → `decisionReadModelSchema`. Verify a
     stage-less item/decision still PARSES on read.

## Render marker

- [x] 7. `apps/web/src/components/lead/item-card.tsx`: replace the empty-selection
     "All stages" label with the loud "No stage set" warning marker, mirroring the
     risk row (warning tokens, `title`/`aria-label`). Drop the disguised label.
- [x] 8. `apps/web/src/components/lead/decisions-section.tsx`: replace the
     empty-selection "all stages" label (and matching aria-label) with the
     "No stage set" warning marker, mirroring the risk row.

## Tests

- [x] 9. Shared-schema tests: `itemInputSchema` and `decisionInputSchema` reject
     empty/absent `stageIds`; the read-model schemas still accept empty `stageIds`
     (prove both teeth and tolerance).
- [x] 10. Item-card and decisions-section render tests: a stage-less row shows
      "No stage set" and no "All stages"/"all stages" label. Update any existing
      test asserting the old disguised label.

## Verify and gate

- [x] 11. Live-verify on the small seed: every seeded item/decision shows a real
      stage (no "No stage set" on healthy seed data); submitting a section still
      works. Optionally insert a stage-less row to confirm the marker renders, then
      remove it.
- [x] 12. Gates green: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      `pnpm format:check`.
