# Require a concrete SDLC stage on items and decisions

## Why

Live-demo feedback (2026-06-18): a lead must not be able to file a record
"into the void" — every item/risk/decision they add should be pinned to a stage
they own on the chosen product, with no silent "applies to everything" fallback.

Investigation (verified live) shows the access-consistency the user worried about
is **already enforced**: the add dialogs list only the lead's own products, the
stage selector lists only the owned stages of the selected product and updates on
product switch, and a single owned stage is auto-applied and locked. **Risks**
already require a concrete stage at every layer (`risk-stage-integrity`).

The one real gap is the deliberate exemption that `risk-stage-integrity` granted
items and decisions: their empty stage selection means "all assigned stages", so
the item/decision dialogs let a lead save with no stage. The user has decided to
**reverse that exemption**: items and decisions must also carry a concrete stage.
"All stages" stays expressible by selecting every chip.

## What Changes

- The **item** and **decision** edit dialogs require at least one stage when the
  product has owned stages — mirroring the risk dialog: a single owned stage is
  auto-applied; otherwise saving with no stage is blocked with
  "Select at least one stage."
- `StageMultiSelect` gains a `required` flag so its helper copy no longer reads
  "Optional. Leave empty to apply to all assigned stages." when the host dialog
  requires a stage (this also corrects the risk dialog's stale "optional" copy).
- No change to the already-correct option restriction (own products, own stages
  per product) or to the single-stage auto-lock.

## Out of scope (documented follow-up)

- **Write-schema enforcement.** `risk-stage-integrity` tightened
  `riskInputSchema` to reject empty `stageIds` server-side. The parallel
  tightening of `itemInputSchema` / `decisionInputSchema` (and the matching
  "No stage set" render marker for stage-less legacy item/decision rows) is the
  defense-in-depth follow-up. It has a broader blast radius (both seed tiers and
  fixtures must carry explicit stages first), so it is tracked separately, not in
  this dialog-layer change.
- Scoping the **decision** dialog's stage list to the selected product. Today it
  offers the lead's owned stages across all products (a flat `availableStages`),
  not per-product like the item dialog. Pre-existing; noted, not fixed here.

## Impact

- Affected specs: MODIFIED requirement in `risk-stage-integrity` (items and
  decisions are no longer exempt at the dialog layer).
- Affected code: `apps/web/src/components/lead/item-edit-dialog.tsx`,
  `decision-edit-dialog.tsx`, `stage-multi-select.tsx` (required flag),
  `risk-edit-dialog.tsx` (pass the flag). New dialog tests for the required-stage
  rule.
