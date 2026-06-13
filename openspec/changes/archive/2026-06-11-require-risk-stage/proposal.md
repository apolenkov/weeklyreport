# Require an SDLC Stage on Every Risk

## Why

User review of the lead report page (2026-06-10, right after the
lead-surface fixes acceptance) set the rule: a risk must always carry a
concrete SDLC stage — «стадия должна быть всегда». Investigation shows
the risk edit dialog ALREADY enforces "Select at least one stage."
(`risk-edit-dialog.tsx:218-220`), but the contract leaks everywhere
else: the shared write schema accepts risks without stages
(`section.schema.ts:44` — `stageIdsField` is `.optional()`), the card
silently renders the empty case as "All stages"
(`risks-section.tsx:173`), and seeds never write `stageIds` at all —
seeded risks surface a stage only through the deprecated legacy
`stageName` fallback.

## What Changes

1. Tighten the write contract: `riskInputSchema.stageIds` becomes
   required with `min(1)` (risks only; items/decisions keep their
   semantics). **BREAKING** for API callers that submit risks without
   stages — the lead dialog already cannot.
2. Replace the silent "All stages" display fallback on risk cards with
   a loud explicit empty-state marker (e.g. "No stage set" warning
   chip) so anomalous legacy rows are visible, not disguised.
3. Migrate legacy data forward: rows whose stages live only in the
   deprecated `stageName` column get `stageIds` backfilled via the
   existing `splitStageNames` mapping; seeds write `stageIds`
   explicitly.
4. Unit tests for the schema guard, the dialog guard (already-passing
   contract pin), and the no-fallback rendering.

**Non-goals:** items and decisions keep optional stages (an item with
no stages means "all assigned stages" by design; decisions are often
product-wide — flag for a separate sign-off if the user extends the
rule); no rename of the legacy `stageIds`→`stageNames` field
(TODO(STAGE-NAMING-01) stays deferred).

**Related finding (recorded, NOT in scope):** risk/item/decision cards
resolve product names only from the section's own project list, so a
risk pointing at a real but unassigned project renders "Unknown"
(`lead-form.ts:433/466`) — the lead-surface counterpart of the shipped
`report-badge-resolution` fix for the head surface. Needs its own
change if prioritized.

## Capabilities

### New Capabilities

- `risk-stage-integrity`: every risk carries at least one concrete
  SDLC stage — enforced at the form, the write schema, and the seed
  data; empty legacy rows render an explicit warning, never a silent
  "All stages".

### Modified Capabilities

<!-- none: lead-report-controls-integrity is untouched; this is a data
contract, not a control-honesty rule -->

## Impact

- `packages/shared/src/schemas/section.schema.ts` (`riskInputSchema`).
- `apps/web/src/components/lead/risks-section.tsx` (display fallback).
- `apps/web/src/components/lead/risk-edit-dialog.tsx` (contract pin
  test only — validation already exists).
- `prisma/seed-simple.ts` (+ `seed.ts` if it seeds risks) — explicit
  `stageIds`.
- Legacy-data backfill path for rows with only `stageName` set.
- API: tRPC draft-save/submit paths validate through the shared schema
  — tightening is server-enforced automatically.
