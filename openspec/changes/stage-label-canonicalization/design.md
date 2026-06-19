# Design — stage label canonicalization

## Root cause (verified)

| Layer          | File                                                              | Spelling            | Role                                       |
| -------------- | ----------------------------------------------------------------- | ------------------- | ------------------------------------------ |
| Seed           | `prisma/seed-constants.ts`                                        | `Development`       | stored canonical ("per admin decision")    |
| Web stage list | `apps/web/src/lib/mappers/lead-form.ts` `STAGE_NAMES`             | `Dev`               | feeds dialog chips → stored on new records |
| Alias (match)  | `apps/web/src/components/lead/stage-tags.ts` `canonicalStageName` | `dev → Development` | tolerance for matching                     |
| Alias (match)  | `apps/web/src/lib/mappers/lead-form.ts` `normalizeStageName`      | `development → dev` | lowercase match key                        |
| Card render    | `apps/web/src/components/lead/item-card.tsx`                      | raw `stageId`       | shows whatever was stored                  |

The two alias helpers point opposite ways but both only feed _matching_
(case-insensitive equality), so they are harmless. The single defect is
`STAGE_NAMES` storing the short `Dev` as if it were canonical, which then renders
raw on the card.

## Decision

1. **Fix the source, not the alias.** Change the `STAGE_NAMES` `Development` slot
   from `"Dev"` to `"Development"`. Every dialog sources stages from this list via
   `ownedStagesForProject`, so new records immediately store the canonical name.
   Leave `canonicalStageName` / `normalizeStageName` / `stageNamesMatch` /
   `riskCoversStage` untouched — they keep reading legacy `Dev` rows.

2. **Per-surface display.**

   - Record tag surfaces (item-card; any sibling that renders a raw stored
     `stageId` as text) canonicalize at render via `canonicalStageName`. This is a
     pure display heal — no migration, legacy `Dev` rows read as `Development`.
   - The SDLC pipeline chip keeps its short `Dev` via a display-only label map
     (canonical → short) applied at the chip, never to the stored/matched value.
     If a short label is needed, derive it from the canonical name; do not store
     it.

3. **No backfill.** MVP DB is disposable; a reseed already produces canonical
   rows, and the render heal covers any non-reset dev DB.

## Risk / regression watch

- `stage-chip-config.ts` keys icons by BOTH `Dev` and `Development` — keep both
  keys so the pipeline short label still resolves an icon.
- Tests that assert the literal `Dev` as a stored value or a card label must move
  to `Development`; tests asserting the pipeline chip's short label stay as `Dev`.
- `risk-stage-integrity` / `status-risk-unification` matching must stay green —
  prove by running their suites (the alias layer is unchanged, so they should).

## Out of scope

The alias layer, a data migration, and the pipeline 7-across layout.
