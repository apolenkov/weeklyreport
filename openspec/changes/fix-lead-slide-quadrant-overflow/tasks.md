# Tasks

## 1. Web — quadrant overflow (apps/web)

- [x] 1.1 In `slides/lead-unified-slide.tsx`, replace the `QuadrantCard`
      `overflow-hidden` with `overflow-y-auto` + `min-h-0` so the card scrolls
      within its `auto-rows-fr` row instead of expanding it (no literal
      `max-height` — the row track supplies the height). Move the per-quadrant
      floor OFF the card and onto the grid track: `grid-auto-rows:
    minmax(var(--slide-quadrant-min), 1fr)` (Tailwind
      `auto-rows-[minmax(var(--slide-quadrant-min),1fr)]`) so the floor + equal
      distribution live on the track and do not collide with the card's
      `min-h-0`. Keep the stripe, the dashed empty placeholder, and the
      fullscreen `dvh` behaviour; verify the layout interplay live.
- [x] 1.2 Reconsider the per-row `line-clamp-3` now that the card scrolls —
      KEPT: `line-clamp-3` bounds each row to <=3 lines so the scroll is about
      row COUNT (predictable), not unbounded row height; the data-loss fix is
      row-count reachability via scroll. Surgical — the row span is unchanged.
- [x] 1.3 Confirm the equal-zone grid and the "fills its frame" behaviour are
      unchanged: the `1fr` upper bound preserves equal distribution; the
      `[:fullscreen_&]:min-h-[60dvh]` + `content-between` are untouched. NOTE:
      the parallel `status-slide-deck.tsx` HeadSectionCard has the identical
      `overflow-hidden` pattern but is OUT OF SCOPE (lead-only change) and is
      left as-is (possible follow-up).

## 2. Tests (apps/web)

- [x] 2.1 jsdom: render `LeadUnifiedSlide` with a quadrant of many rows; assert
      the card class is scroll-reachable (`overflow-y:auto` + `min-h-0`, NOT
      `overflow:hidden`) and the grid track uses `minmax(var(--slide-quadrant-min),
    1fr)`. NOTE: do NOT rely on "every row node present" as the regression guard —
      rows are already in the DOM under `overflow:hidden` (it clips visually, not
      structurally), so that assertion passes against the buggy code too. Visual
      reachability is proven only by the live height check below. (The CLASS
      assertions are the teeth; "every row present" + "no +N more" are secondary
      spec-invariant checks.)
- [x] 2.2 Assert no "+N more" affordance is introduced and the
      `--slide-quadrant-min` floor + equal-zone layout persist.

## 3. Docs & specs

- [x] 3.1 `lead-slide-quadrants` delta — quadrant overflow is scroll-reachable,
      not clipped (this change).
- [x] 3.2 Record in the PR/handoff the deferred user decision: scroll (this
      baseline) vs taller/multi-page frame vs continuation slides — RESOLVED
      2026-06-21: the user chose SCROLL-ONLY (no fit/split; that would reverse
      the 2026-06-10 sign-off). This change is the final answer for theme C
      overflow.

## 4. Verification

- [x] 4.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
      (combined gate across all five changes — see the implementation branch).
- [ ] 4.2 Live: on a dense lead Summary slide every row is reachable by scroll
      inside its quadrant; sparse quadrants still fill their zone; fullscreen
      still works. (Live-verify phase — see handoff.)
- [x] 4.3 `openspec validate fix-lead-slide-quadrant-overflow --strict`.
