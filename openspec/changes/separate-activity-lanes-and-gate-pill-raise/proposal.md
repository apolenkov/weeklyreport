# Separate activity lanes from the product grid; gate activity pill raises on risk creation

## Why

Two feedback items from the 2026-07-06 walkthrough. (1) Activity lanes render
as extra columns inside the week boards' product grid, so a stage-less activity
reads as a peer product column — the two levels blur together. The slides
already solve this: activities live in their own lighter row below the product
grid. (2) The activity status pill still allows a manual raise to At Risk /
Blocked with no covering risk — the one surface left where an alarm can exist
without a risk row, contradicting the risks-as-single-source rule the stage
chips and item cards already enforce.

## What Changes

- Current/Next week boards: activity lanes move OUT of the shared product grid
  into a separate, lighter "Activities" block below it (the slide precedent —
  `SlideActivityPills` renders as its own row). No in-grid divider.
- Activity status pill: clicking At Risk / Blocked without a sufficient
  covering risk no longer persists the status — it opens the risk dialog in
  create mode with the activity preselected and the clicked severity prefilled
  (the pill analogue of the stage-chip raise interception). Lowering below the
  floor stays refused with the existing message.
- The activity pill's alarm floor is re-derived at render time from the live
  draft risks, so a just-created activity risk floors the pill immediately
  (no save+refetch), mirroring `applyRiskSeverityFloor` for stage chips.
- **BREAKING (spec)**: strikes the "absent any risk or blocker, the lead's
  manually chosen status stands" allowance for above-green choices in
  `activity-reporting-unit`; green stays directly settable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `activity-reporting-unit`: an activity's At Risk/Blocked status may no longer
  be authored as a bare manual pick — the raise routes through activity-scoped
  risk creation; the lane presentation on the week boards moves to a separate
  block below the product grid.

## Impact

- `apps/web/src/components/lead/current-week-section.tsx`,
  `next-week-section.tsx`, `next-week-columns.ts` — board render split; a new
  shared activity-lanes block component.
- `apps/web/src/components/lead/activity-status-section.tsx` (+ test) — raise
  interception; the "lets the lead lower a status they raised themselves" test
  is rewritten around the new gate.
- `apps/web/src/components/lead/lead-form-sync-bridge.tsx` (`RiskPrefillRequest`),
  `risks-section.tsx`, `risk-edit-dialog.tsx`, `lead-form.tsx` — the prefill
  channel grows an activity side; the risk dialog gains `defaultActivityId`.
- New `apps/web/src/lib/activity-alarm.ts` — client-side activity alarm-floor
  derivation (parity with the server's `deriveActivityStatus`).
- Downstream readers are safe: all consumers of an activity's status already
  read the derived value (`derivedStatus ?? status`).
