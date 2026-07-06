# Simplify stage-status interaction: chip = on-track toggle, alarms only from risks

## Why

The stage chip's four-option status menu duplicates state that risks already
own. A lead can click At Risk/Blocked on a chip, which today opens risk
creation — a two-step dance whose menu text ("→ create risk") the owner still
found confusing, and whose At Risk-on-a-blocked-chip path produces an opaque
"can't lower" toast. The owner's ask (2026-07-06): make the chip a plain toggle
that only sets On Track; author at-risk/blocked exclusively in the Risks &
Blockers section (adding a risk floors the chip; removing every covering risk
clears it back to the lead's On Track or to grey); forbid marking On Track while
a covering risk exists; and at submit, auto-promote any grey stage to On Track
after warning the lead. This "облегчает синхронизацию" — one authoring surface
for alarms, none of the menu machinery.

## What Changes

- **Chip click is a plain On Track toggle.** An editable chip toggles between
  grey (empty) and On Track. There is NO status menu, NO At Risk/Blocked option
  on the chip. **BREAKING**: removes the four-option popover
  (`stage-chip-menu.tsx`) and today's "→ create risk" hint (shipped this
  session, commit 499f213).
- **At-risk/blocked come only from risks.** A covering risk floors the chip at
  render (the existing `applyRiskSeverityFloor`); removing all covering risks
  returns the chip to its stored On Track/grey. Clicking a risk-floored chip
  does nothing but show a "resolve the risk to change this" hint.
- **Remove the chip-driven risk flows.** The D2 chip-raise interception and the
  D3 lower-a-covered-chip confirmation dialog in `lead-form-sync-bridge.tsx` go
  away, along with the three now-dead toasts (`BLOCKED_FLOOR_LOWER_MESSAGE`,
  `CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE`, and the unbacked-raise route) and the
  `riskGap` prop chain that fed the deleted menu hint.
- **Fix the orphan-severity render disagreement (council find C).** Make the
  render floor `applyRiskSeverityFloor` call `deriveEffectiveStageStatus`
  unconditionally (drop its `covering.length === 0` early return), so an
  explicit at-risk/blocked stage with no covering risk collapses to On Track on
  the live form exactly as the read model already does. This is also the
  migration answer for legacy explicit-severity rows — no backfill script.
- **Grey stages auto-promote at submit, with a warning.** The submit-confirm
  dialog gains a "N stage(s) not set — they will be marked On Track" notice;
  on confirm, grey own stages are written as On Track (mirrors the existing
  null→green project-status coercion in `handleConfirmSubmit`).
- **One-click severity toggle on the risk card.** A blocked↔at-risk toggle on
  `RiskCard` so the owner's "downgrade a blocker to a risk" is a single click,
  not a full dialog re-open.
- The chip aria/tooltip "status set" suffix now applies only to On Track (the
  only severity a lead can set explicitly); at-risk/blocked read "by risk".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-risk-unification`: the chip no longer authors at-risk/blocked (nor
  routes to risk creation) — it is a plain On Track toggle; lowering a covered
  chip is removed (the risk is the only lever); grey stages auto-promote to On
  Track at submit after a warning.

## Impact

- `apps/web/src/components/lead/stage-chip.tsx`, `stage-chip-menu.tsx` (DELETE),
  `sdlc-pipeline.tsx`, `lead-form-sync-bridge.tsx` — remove the menu, the
  interception/confirm flows, the toasts, and the `riskGap` chain; chip becomes
  a toggle; `applyRiskSeverityFloor` collapses orphans unconditionally.
- `apps/web/src/components/lead/lead-form.tsx` — grey-stage submit coercion +
  the submit-confirm warning.
- `apps/web/src/components/lead/risk-card.tsx` — the severity toggle.
- Tests: `sdlc-pipeline.test.tsx`, `stage-chip.test.tsx` (delete the menu-hint
  cases added this session), `lead-form-sync-bridge.test.tsx`, plus new toggle
  and submit-coercion coverage. Check the e2e catalogs and ai-driver oracles for
  chip-menu assumptions.
