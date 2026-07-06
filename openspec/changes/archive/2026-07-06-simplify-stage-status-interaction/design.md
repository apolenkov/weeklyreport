# Design

## Context

Plan point 6 from the 2026-07-06 walkthrough, council-vetted (Codex, 2026-07-06).
This reverses the chip-menu interaction shipped earlier the same day (the P4
"→ create risk" hint, commit 499f213) and the older D2/D3 chip-driven risk
flows. The risk-derived render floor stays — only the chip's authoring role
changes. The owner settled both product forks via approval: grey stages
auto-promote to On Track at submit (warn, don't block); the risk-card severity
toggle ships with this change.

## Goals / Non-Goals

- Goal: one authoring surface for at-risk/blocked (the Risks section); the chip
  only expresses On Track vs unset.
- Goal: no live-form/read-model disagreement for orphan explicit severities.
- Non-Goal: changing how a covering risk floors the chip at render
  (`applyRiskSeverityFloor` / `deriveEffectiveStageStatus` stay the floor).
- Non-Goal: the head/PDF surfaces (no per-stage grid — unaffected).

## Decisions

### D1 — The chip is a two-state toggle, no menu

`StageChip` loses its popover entirely (`stage-chip-menu.tsx` is deleted). An
editable chip's click calls `onStatusChange(stageName, next)` where `next`
toggles `empty ⇄ on-track` off the RAW status. A risk-floored chip (display
severity above the raw status) is not directly editable: clicking it shows the
existing inline "resolve the covering risk/blocker first" style hint rather than
mutating. `riskGap` (and its `sdlc-pipeline.tsx` → `stage-chip.tsx` prop chain)
is deleted — it existed only to power the removed menu hint.

### D2 — Remove the chip-driven risk flows and their toasts

In `lead-form-sync-bridge.tsx`, `handleStageStatusChange` collapses to: if the
chip is risk-floored, ignore (hint); else apply the on-track/empty toggle
through `sync.handleStageStatusChange`. Delete the D2 raise-interception branch
(no more `setRiskPrefill` from a chip), the D3 `pendingLower` confirmation
dialog + `confirmLower` + `removeStageFromCoveringRisks`/`describeLowerEffects`
usage from this path, and the three toasts (`BLOCKED_FLOOR_LOWER_MESSAGE`,
`CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE`, unbacked-raise). Lowering a covered chip is
no longer a gesture — the lead removes the risk in the Risks section, and the
chip un-floors automatically. (Keep `removeStageFromCoveringRisks` only if the
risk-card severity toggle or delete still needs it; otherwise remove.)

### D3 — Collapse orphan explicit severities at render (council find C)

`applyRiskSeverityFloor` currently early-returns `stage` when
`covering.length === 0`, so a stage persisted at at-risk/blocked with NO
covering risk renders at that severity on the live form forever, while
`buildStageGrid` (read model) already collapses it to on-track via
`deriveEffectiveStageStatus`. Drop the early return and always route through
`deriveEffectiveStageStatus(stage.status, covering, [])`, so the live form and
read model agree. This is load-bearing under D1: with no chip menu, there is no
other UI path to "fix" such a row. It also IS the migration — legacy explicit
at-risk/blocked stage rows simply render as On Track next load; no backfill.

### D4 — Grey stages auto-promote to On Track at submit, after a warning

`handleConfirmSubmit` already coerces null project/activity statuses to green.
Extend the same pattern to own stage statuses: map any grey (unset) own stage to
On Track in the submit payload. Surface it first: the `showSubmitConfirm` dialog
body gains a "N stage(s) not set — they'll be marked On Track" line (0 → omit),
so the promotion is warned, not silent. Non-blocking, per the owner. `empty`
stays a valid interim state while editing; only submit promotes it.

### D5 — One-click severity toggle on RiskCard

`RiskCard` gains a compact blocked↔at-risk toggle (icon button) beside Edit,
calling back to flip `severity` on that risk without opening the full dialog —
the owner's "downgrade a blocker to a risk" in one click. The full dialog stays
for text/stage edits.

## Migration

Legacy explicit at-risk/blocked stage rows: no migration script. D3 makes them
render as On Track on next load (the read model already did). The DB `StageStatus`
row keeps its stale value until the next save, which writes the collapsed value.

## Risks / Trade-offs

- Removing the confirm-lower flow means a lead who wants to clear a
  risk-floored chip must go to the Risks section — acceptable, since the risk is
  the single source and the chip hint points there.
- Deleting today's menu-hint tests + the D2/D3 tests is expected churn; the new
  behavior gets its own toggle + submit-coercion tests. Sweep the e2e catalogs
  and ai-driver oracle catalogs for chip-menu assumptions before landing.

## Verify

- Live: a chip toggles On Track/grey with a single click, no menu; adding a
  covering risk floors it, deleting the risk un-floors it; a risk-floored chip
  refuses On Track with a hint; submit warns about N grey stages then promotes
  them; the risk-card severity toggle flips blocked↔at-risk in one click.
- A legacy explicit-blocked stage with no covering risk renders On Track on the
  live form (matches read model).
