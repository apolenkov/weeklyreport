# Design — Require an SDLC Stage on Every Risk

## Context

The rule comes from the user (2026-06-10): a risk must always carry a
concrete SDLC stage. Current state, verified in code:

- `risk-edit-dialog.tsx:205-220` already blocks save with "Select at
  least one stage." and auto-picks when exactly one stage is available.
- `section.schema.ts:38-46` — `riskInputSchema.stageIds` uses the
  shared `stageIdsField` (`z.array(z.string()).max(20).optional()`),
  so the API accepts stage-less risks; the dialog is the only fence.
- `risks-section.tsx:163-173` — empty stages render as the silent
  "All stages" label, fed by the deprecated `stageName` fallback for
  legacy rows.
- `prisma/seed-simple.ts` writes no `stageIds` on risks (0 matches);
  seeded cards show a stage only via the `stageName` legacy column.

## Goals / Non-Goals

**Goals:** make "risk always has ≥1 concrete stage" true at every
layer: write schema, display, seeds, legacy rows.

**Non-Goals:** items and decisions keep optional stages (different
semantics; extending the rule needs its own sign-off); the
`stageIds`→`stageNames` rename (TODO(STAGE-NAMING-01)) stays deferred;
no UI redesign of the stage picker.

## Decisions

### D1 — Risk-specific required field, shared field untouched

`riskInputSchema` gets its own `stageIds: z.array(z.string()).min(1)
.max(20)` instead of the shared optional `stageIdsField`. Items and
decisions continue to use `stageIdsField`. Rationale: the rule is
risk-only; mutating the shared field would silently change three
contracts at once.

### D2 — Loud empty-state instead of the "All stages" disguise

`risks-section.tsx` drops the `"All stages"` label for risks: when a
row still has no stages after the legacy fallback, render an explicit
warning chip ("No stage set", amber/warning tokens, consistent with
the existing F4 `needsStage` hint). Honest-empty-state over silent
implication, same principle as `lead-report-controls-integrity`.

### D3 — Backfill legacy rows, then rely on the contract

One-shot backfill: rows where `stageIds` is empty but the deprecated
`stageName` is set get `stageIds = splitStageNames(stageName)`.
Pre-prod MVP rules apply — the dev/UAT databases are disposable and
reseeded; the backfill is a seed fix plus a small data script, not a
formal migration. Seeds write explicit `stageIds` on every risk.

### D4 — Server-side enforcement comes free

tRPC draft-save/submit validates through `riskInputSchema`, so
tightening the schema enforces the rule server-side with no API code
change. The dialog already prevents the case client-side, so leads
never see a new error in the normal flow.

## Risks / Trade-offs

- [Resave of old drafts] a legacy draft with a stage-less risk would
  fail validation on next save → mitigated by D3 backfill (and
  disposable non-prod data).
- [External callers] any non-dialog caller submitting risks without
  stages breaks — acceptable: pre-prod, and the contract change is the
  point. Marked **BREAKING** in the proposal.
- [Cross-author rows] read-only risks from other leads render via the
  same card; the D2 warning chip must not imply the viewer can fix
  them — copy stays neutral ("No stage set").
