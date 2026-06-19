# Tasks — pipeline tooltip honesty + indicator coloring

## 1. Honest reveal content

- [x] 1.1 Hidden-stage objects carry `ownership` (`mine`/`locked`/`unassigned`) +
      `assignee`; use them.
- [x] 1.2 Added `hiddenStageLine`/`hiddenStagesRevealLines`: owned-no-status →
      "<Stage> — <Owner> (no status set)"; owned-with-status → "<Stage> — <Owner>:
      <status>"; unassigned → "<Stage> — unassigned". Never "empty" for an owned stage.
- [x] 1.3 The inert `aria-label` reveal uses the same honest lines (comma-joined).

## 2. Radix tooltip in the pipeline — DEFERRED to the live visual pass

Honest content is multi-line NOW: `useSdlcTooltip` renders `whitespace-pre-line`
and the indicator passes newline-joined lines. The like-for-like swap to the
`packages/ui` Radix `Tooltip` (chips + indicator) is a no-behavior-change visual
refactor that risks the chip popover + many pipeline tests — batched with the
two-column dialog layout for live verification (user-agreed).

- [~] 2.1 `TooltipProvider` mount — deferred (visual pass).
- [~] 2.2 Chip hover → Radix — deferred (visual pass).
- [x] 2.3 Indicator reveals multi-line (one honest line per stage) via the styled
      tooltip; Radix component swap deferred.
- [~] 2.4 Remove `useSdlcTooltip` from the pipeline — deferred (visual pass).

## 3. Full-scale indicator color

- [x] 3.1 `collapsedIndicatorColors` precedence: blocked→red, at-risk→yellow, any
      unfilled→grey, all on-track→green — via `STATUS_CONFIG` tokens, no hardcoded hues.
- [x] 3.2 `getProductCardStyle` (left stripe) and `computeCompleteness` untouched.

## 4. Tests & gates

- [ ] 4.1 Update the #90 scenarios (neutral-when-on-track/empty) to the new
      full-scale behavior.
- [ ] 4.2 Add tests: owned hidden stage reveals owner + "no status set" (not
      "empty"); vacant reveals "unassigned"; all-on-track → green; any-unfilled → grey.
- [ ] 4.3 Wrap pipeline unit tests that render in isolation with a `TooltipProvider`,
      or assert the inert `aria-label` path.
- [ ] 4.4 `status-color-semantics` token guard stays green (no hardcoded hues).
- [ ] 4.5 `pnpm typecheck && pnpm lint && pnpm test` green; live-verify the tooltip is
      multi-line + honest and the indicator color matches the full scale.
