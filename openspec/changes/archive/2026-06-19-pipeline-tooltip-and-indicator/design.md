# Design — pipeline tooltip honesty + indicator coloring

## Current state (verified)

- `sdlc-pipeline.tsx`: in Mine mode `hiddenStages = product.stages.filter(s =>
s.ownership !== "mine")` — a mix of foreign-owned and vacant stages.
- Reveal text: `hiddenStagesRevealText` = `${s.stageName}: ${s.status}`. For a
  foreign-owned stage the current lead never set a status, so `s.status === "empty"`
  → the tooltip prints "DevOps: empty" even though DevOps has an owner.
- Color: `collapsedIndicatorColors` returns the worst hidden status color ONLY for
  `blocked`/`at-risk`, else `NEUTRAL_INDICATOR_COLORS` (grey) — the #90 decision.
- Tooltip: custom `useSdlcTooltip` (apps/web `sdlc-tooltip.tsx`) drives both the chips
  and the indicator. `packages/ui` already exports a Radix `Tooltip` /
  `TooltipContent` / `TooltipProvider` / `TooltipTrigger` (imports `radix-ui`, already
  a dependency).

## Decisions

1. **Honesty.** `StageAssignment` carries `ownership` (`mine` / foreign / unassigned)
   and the owner label used elsewhere in the pipeline. Build the reveal line from
   ownership, not raw `status`:

   - owned by another author, no status → "<Stage> — <Owner> (no status set)"
   - owned, with a status → "<Stage> — <Owner>: <status>"
   - unassigned → "<Stage> — unassigned"
     Verify the owner field is available on the hidden-stage objects; if only initials
     are present, use them (consistent with the pipeline's per-stage author line).

2. **Radix everywhere.** Mount a single `TooltipProvider` at the pipeline root.
   Replace the chip hover (`useSdlcTooltip`) and the indicator hover with
   `Tooltip`/`TooltipTrigger`/`TooltipContent`. Content is a stacked list (one line
   per stage) rather than a comma-join. Keep the inert indicator's `aria-label`.
   Remove `useSdlcTooltip` usage from the pipeline; leaving the hook itself for any
   non-pipeline caller is fine (the separate audit change decides its fate).

3. **Full-scale color.** Replace `collapsedIndicatorColors` precedence with:
   blocked→red, else at-risk→yellow, else any `empty`/unassigned→grey, else (all
   on-track)→green. Reuse `STATUS_CONFIG` tokens; add the on-track (green) and the
   explicit grey branch. The product health stripe (`getProductCardStyle`) and
   `computeCompleteness` are untouched.

## Risk / regression watch

- `status-color-semantics` "colors come from named tokens" — use existing
  `STATUS_CONFIG` / token vars, no hardcoded hues.
- The item-row chip (`item-card.tsx`) MUST stay identity-only (`CONTEXT.md`); do not
  touch it.
- #90's two scenarios ("neutral when on-track/empty") are intentionally reversed —
  update those tests, don't keep them.
- Radix tooltip needs a provider in the pipeline render tree and in the unit-test
  render harness; some pipeline unit tests render the component in isolation
  (no provider) — wrap them or assert the inert `aria-label` path.

## Out of scope

Item-row chip styling, app-wide tooltip-language reconciliation, `useSdlcTooltip`
removal beyond the pipeline.
