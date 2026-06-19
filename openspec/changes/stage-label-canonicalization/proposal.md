# Stage label canonicalization

## Why

A lead noticed that records they add through a dialog show the stage as **"Dev"**,
while seeded records on the same product show **"Development"** — "ощущение, что
это не единый список". The list looks inconsistent because two opposite
normalizers coexist:

- `apps/web/src/lib/mappers/lead-form.ts` declares `STAGE_NAMES` with the SHORT
  literal `"Dev"`, so a record created through a dialog stores `"Dev"` as its
  `stageId`.
- The seed (`prisma/seed-constants.ts`, "per admin decision") stores the FULL
  canonical `"Development"`.
- `apps/web/src/components/lead/item-card.tsx` renders the raw `stageId`, so the
  two spellings show side by side.

The alias layer (`canonicalStageName` `dev→Development`, `stageNamesMatch`,
`riskCoversStage`) was added precisely to TOLERATE both spellings for matching,
and the SDLC pipeline chip deliberately uses the short `"Dev"` to fit seven chips
in one row. The fix is therefore narrow: make the STORED identifier always
canonical and decide the DISPLAY label per surface — not rip out the alias layer.

## What Changes

### 1. Canonical stored stage identifier — CONFIRMED

The stored stage identifier (`stageIds` on items / risks / decisions) MUST be the
full canonical SDLC name (`Development`, not `Dev`). `STAGE_NAMES` in
`apps/web/src/lib/mappers/lead-form.ts` is corrected from `"Dev"` to
`"Development"`, so every dialog (which sources its chips from `STAGE_NAMES` via
`ownedStagesForProject`) now stores the canonical name. The match-tolerance layer
(`canonicalStageName`, `normalizeStageName`, `stageNamesMatch`, `riskCoversStage`)
is UNCHANGED — it keeps reading legacy `"Dev"` rows correctly.

### 2. Display label is per-surface — CONFIRMED

The record stage chip on a card (and any surface that renders a raw stored
`stageId` as text) MUST display the canonical name, canonicalizing legacy values
at render through the existing `canonicalStageName`, so a stored `"Dev"` reads as
`"Development"` with no data migration. The SDLC pipeline chip MAY keep a
display-only short label (`Development → "Dev"`) for its seven-across layout; the
short form is a rendering choice and never the stored or matched value.

## Out of scope

- Removing or rewriting the alias / match-tolerance layer — it stays so legacy
  `"Dev"` rows keep matching.
- A data migration to rewrite stored `"Dev"` rows — the MVP database is
  disposable and the render-time canonicalize heals display either way.
- The pipeline chip's short label and 7-across layout — unchanged.
