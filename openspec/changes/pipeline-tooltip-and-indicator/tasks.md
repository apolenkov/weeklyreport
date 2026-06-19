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

- [x] 4.1 Update the #90 scenarios (neutral-when-on-track/empty) to the new
      full-scale behavior. (`sdlc-pipeline.test.tsx`: at-risk/grey/green indicator cases.)
- [x] 4.2 Add tests: owned hidden stage reveals owner + "no status set" (not
      "empty"); vacant reveals "unassigned"; all-on-track → green; any-unfilled → grey.
      (Covered, incl. the co-owner-initials regression case.)
- [x] 4.3 Wrap pipeline unit tests that render in isolation with a `TooltipProvider`,
      or assert the inert `aria-label` path. (`SdlcTooltipProvider` wrap + aria-label asserts.)
- [x] 4.4 `status-color-semantics` token guard stays green (no hardcoded hues).
- [x] 4.5 `pnpm typecheck && pnpm lint && pnpm test` green; live-verify the tooltip is
      multi-line + honest and the indicator color matches the full scale.

## 5. Review disposition (Codex + multi-agent, 2026-06-19)

- [x] 5.1 Cross-author color fix: §3's `collapsedIndicatorColors` read the raw
      Mine-mode status (always `empty` for foreign stages → always grey on the live
      surface). Now derives from the same cross-author-resolved set as the reveal
      (`hiddenStagesEffectiveStatuses`), with a regression test. Commit `ba3260f0`.
- [ ] 5.2 BLOCKER for archive — Radix swap owed (user decision 2026-06-19): the
      `lead-pipeline-card` spec's first requirement MANDATES the shared Radix
      `Tooltip`. The user chose to KEEP Radix required (NOT to soften the spec), so
      this change is genuinely INCOMPLETE until §2's Radix swap lands — replace the
      pipeline's custom `useSdlcTooltip` (chips + collapsed indicator) with the
      `packages/ui` Radix `Tooltip`. The honest multi-line reveal + cross-author
      indicator colour already ship; only the tooltip-component swap remains. Do NOT
      archive this change until the swap is done.
