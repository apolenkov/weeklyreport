## Why

The shipped `risk-stage-integrity` capability requires every risk to carry at
least one concrete SDLC stage, but the implementation has three gaps that the
repo-excellence review flagged as P1 (`BL-RISK-STAGE-INTEGRITY` /
`docs/repo-excellence-review-2026-06-28.md`):

- `handleSave` in `apps/web/src/components/lead/risk-edit-dialog.tsx` derives
  `effectiveStageIds` and blocks save with "Select at least one stage." whenever
  the selection is empty — with NO guard for the case where the lead owns zero
  stages on the chosen product (`availableStages.length === 0`) AND the row has
  no stage of its own. Such a stage-less risk is then permanently unsaveable,
  directly contradicting the `stagesForProduct` prop JSDoc that promises a
  disabled Save plus a "no stages assigned — contact admin" message for an empty
  owned-stage set. (A cross-stage risk that already carries `stageIds` is a
  separate, valid case that must stay saveable.)
- In `apps/web/src/components/lead/stage-multi-select.tsx` the consequence banner
  shows `All assigned stages will show as <severity>.` for an empty selection
  even when `required` is true. In required mode an empty selection is invalid,
  so the banner falsely promises an "all stages" outcome that cannot happen.
- `requiredStageIdsField` in
  `packages/shared/src/schemas/report-primitives.schema.ts` is
  `z.array(z.string()).min(1).max(MAX_SELECTED_STAGES)` with NO per-element
  validation. So `[""]` or a null-byte element satisfy the array `.min(1)`, defeating the
  require-a-real-stage intent and letting null bytes reach the Postgres write
  (500 on the array column). A per-element `.min(1)` alone would still admit a
  whitespace-only `[" "]`, so visible-content validation is needed as well.

This change extends the existing `risk-stage-integrity` spec to close those three
gaps. No new capability is introduced.

## What Changes

- Add a zero-owned-stage guard to the risk dialog: when
  `availableStages.length === 0 && effectiveStageIds.length === 0`, the dialog
  MUST NOT block on the required-stage rule; instead it disables Save and shows
  the documented "no stages assigned — contact admin" message, so the lead is
  never dead-ended. The guard makes `handleSave` an early-return no-op (it MUST
  NOT fall through to `onSave` with an empty `stageIds`), and the Ctrl/Cmd+Enter
  keyboard shortcut — which routes through the same `handleSave` — respects it so
  no empty payload escapes via the keyboard. A cross-stage risk that already
  carries `stageIds` (its product is outside the stage-owned list) stays
  saveable.
- Suppress the empty-selection "All assigned stages…" banner when the stage
  selector is in `required` mode, so the banner never advertises an outcome the
  required rule forbids.
- Tighten `requiredStageIdsField` (and the shared stage-element contract) so each
  array element is a non-empty, visible, null-byte-free string
  (`z.string().min(1).refine(noNullBytes).refine(noInvisibleOnly)`), rejecting
  `[""]`, whitespace-only `[" "]`, zero-width-only, and null-byte elements.
- Add tests for the three behaviours (dialog zero-owned-stage path, banner copy
  in required mode, schema element rejection).

This is correctness hardening of an existing capability; the canonical "a risk
always carries at least one concrete SDLC stage" contract is preserved and
strengthened, not weakened.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `risk-stage-integrity`: extends the existing capability with a zero-owned-stage
  dialog guard, required-mode banner honesty, and per-element validity for stage
  id arrays.

## Impact

- `apps/web/src/components/lead/risk-edit-dialog.tsx` — add the
  `availableStages.length === 0 && effectiveStageIds.length === 0` branch
  (disabled Save + contact-admin message) before the required-stage block, as an
  early-return no-op so `onSave` is never called with empty `stageIds`; the
  Ctrl/Cmd+Enter keyboard path inherits the guard via `handleSave`. A
  cross-stage risk that already carries `stageIds` stays saveable.
- `apps/web/src/components/lead/stage-multi-select.tsx` — suppress the
  empty-selection banner when `required` is true.
- `packages/shared/src/schemas/report-primitives.schema.ts` — constrain
  `requiredStageIdsField` elements with
  `z.string().min(1).refine(noNullBytes).refine(noInvisibleOnly)`.
- Tests: risk-dialog component test, stage-multi-select component test, shared
  schema unit test.
