# Proposal: D37-V30 risk readOnly/a11y preservation (C3044, C5142, C5144)

## Why

Three D37-V30 findings reproduce against the real `RisksSection` consumer with
schema-admitted props, each at an already-owned contract boundary:

- C3044: a chip/pill raise signal arriving while the section is `readOnly`
  cached its stage/severity prefill (`LeadFormSyncBridge.Risks` forwards
  `addPrefill` regardless of `readOnly`; `openCreate` no-ops but the cache
  survived). The next plain +Add back in editable mode opened pre-selected,
  against `risk-stage-integrity` ("Record dialogs do not pre-select stages on
  create").
- C5142: a foreign (locked) stage-less card on a flagged product showed the
  "Select at least one stage" nudge while offering no edit affordance
  (`LockBadge` only). The nudge implies an action the viewer cannot take.
- C5144: `productName: ""` was runtime-reachable (`buildActivityRiskEntry`
  with an unresolved activity name) and produced dangling action labels
  ("Edit risk for "), dropping the row identity for non-visual users against
  the `lead-pipeline-card` non-visual naming pattern.

C3042 (stale-target toggle) is explicitly NOT part of this change: no real
current UI producer holds a stale target across an update (single-render
`RiskList` → `RiskCard` → `toggleSeverity` closure, no memo/async boundary;
same-batch double-invoke is idempotent), so its source hunk stays at baseline
and the claim stays needs-evidence.

## What Changes

- `useRiskRaisePrefill` consumes the signal but returns before
  `setCreatePrefill`/`openCreate` under `readOnly`. One-shot signal semantics
  and the readOnly no-dialog guard are unchanged.
- `deriveRiskCardState` derives `locked` first and gates `needsStage` on
  `!locked` (was `!readOnly`). Foreign lock disclosure is unchanged.
- One `riskDisplayName` helper (trimmed, `"Unknown"` fallback, the
  lead-surface-name-resolution placeholder) serves the toggle/edit/delete
  labels, the card title and the delete confirmation subtitle, and
  `buildActivityRiskEntry` now produces `"Unknown"` for an unresolved activity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `risk-stage-integrity`: a readOnly-window raise signal MUST NOT prefill a
  later create dialog; a locked risk card MUST NOT show the action-implying
  stage nudge.
- `lead-pipeline-card`: risk row action controls MUST expose a non-empty
  accessible name identifying the row.

## Impact

Three owned sources plus four regression cases in the already-owned
`risks-section.test.tsx` (public consumer/UI events only, no new test files,
no production seams). No dependency, schema, copy-system, focus-policy or
delivery changes.

## Non-goals

- C3042 toggle redesign; C5099/C5130/C5131/C5135/C5143/C5137/C5149 decisions.
- Richer activity-aware fallback copy; new live-region, focus, radiogroup or
  id-namespacing behavior. Main specification synchronization.
