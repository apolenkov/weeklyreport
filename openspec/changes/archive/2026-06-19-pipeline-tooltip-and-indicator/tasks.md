# Tasks — pipeline tooltip honesty + indicator coloring

## 1. Honest reveal content

- [x] 1.1 Hidden-stage objects carry `ownership` (`mine`/`locked`/`unassigned`) +
      `assignee`; use them.
- [x] 1.2 Added `hiddenStageLine`/`hiddenStagesRevealLines`: owned-no-status →
      "<Stage> — <Owner> (no status set)"; owned-with-status → "<Stage> — <Owner>:
      <status>"; unassigned → "<Stage> — unassigned". Never "empty" for an owned stage.
- [x] 1.3 The inert `aria-label` reveal uses the same honest lines (comma-joined).

## 2. Radix tooltip in the pipeline — DONE (2026-06-20)

The chips and the `+N more` indicator now reveal through the shared `packages/ui`
Radix `Tooltip` (same component on both). The custom `useSdlcTooltip` is no longer
used anywhere in the pipeline; it survives only for the non-pipeline `lock-badge`
caller (out of scope, per design.md). Live-verified in the browser: dark/light
contrast resolves (`bg-foreground`/`text-background`), the multi-line reveal
stacks, the indicator keeps its worst-status colour, and clicking a chip still
opens the status popover with the tooltip not fighting it.

- [x] 2.1 `TooltipProvider` mounted once at the `SdlcPipeline` root (covers chips + indicator); isolated chip/pipeline tests wrap with `TooltipProvider`.
- [x] 2.2 Chip hover/focus → Radix `Tooltip` (`TooltipTrigger asChild` on the chip
      button; content carries the existing `by risk` / `status set` suffix).
- [x] 2.3 Indicator reveals multi-line (one honest line per stage) — now via the
      shared Radix `Tooltip` (extracted to `CollapsedStagesIndicator`).
- [x] 2.4 `useSdlcTooltip` removed from the pipeline (chips + indicator).

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
- [x] 5.2 Radix swap LANDED (2026-06-20) — the archive blocker is cleared. The
      `lead-pipeline-card` spec's MANDATE for the shared Radix `Tooltip` is now met:
      both the chips and the collapsed `+N more` indicator reveal through the
      `packages/ui` Radix `Tooltip`; the custom `useSdlcTooltip` is gone from the
      pipeline. Implemented sequentially (not army-parallelised — coupled chip
      popover + ref), gated (typecheck + 1219 web tests green, per-file lint clean),
      and live-verified in the browser (contrast, multi-line, indicator colour,
      chip-click popover). This change is now ready to archive.
