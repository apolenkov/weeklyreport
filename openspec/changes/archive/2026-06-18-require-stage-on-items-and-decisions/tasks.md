# Tasks

- [x] 1. `stage-multi-select.tsx`: add a `required?: boolean` prop. When true,
      the helper copy drops "Optional. Leave empty to apply to all assigned
      stages." (and the "Scope: all assigned stages" empty hint) in favor of a
      required-stage line. Default false (back-compat).
- [x] 2. `item-edit-dialog.tsx`: mirror the risk dialog — compute
      `availableStages = stagesForProduct(productId)` and
      `effectiveStageIds` (auto-apply the single owned stage); in `handleSave`
      block with `stageIds: "Select at least one stage."` when
      `availableStages.length > 0 && effectiveStageIds.length === 0`; save
      `effectiveStageIds`. Pass the error + `required` into `StageMultiSelect` and
      clear the error on change.
- [x] 3. `decision-edit-dialog.tsx`: same required-stage rule, keyed on its
      `availableStages` list. Auto-apply a single stage; block empty otherwise.
- [x] 4. `risk-edit-dialog.tsx`: pass `required` to `StageMultiSelect` so its
      helper copy matches the rule it already enforces (no behavior change).
- [x] 5. Tests: item + decision dialogs block save with no stage on a
      multi-stage product, auto-apply a single stage, and still save when a stage
      is chosen. Prove teeth (a no-stage save must fail). Update any existing test
      that asserted the old empty-equals-all behavior.
- [x] 6. Live-verify on the small seed: adding an item/decision to a multi-stage
      product (BI: Planning+Dev) with no stage is blocked; a single-stage product
      (Integrations: Dev) auto-applies.
- [x] 7. Gates green (typecheck, lint, test, format:check).

## Documented follow-up (NOT in this change)

- [x] Tighten `itemInputSchema` / `decisionInputSchema` `stageIds` to
      `requiredStageIdsField` (server-side parity with `riskInputSchema`) and add
      the "No stage set" render marker for stage-less legacy item/decision rows.
      Requires auditing both seed tiers and fixtures for explicit stages first.
