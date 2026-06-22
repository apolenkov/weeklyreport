# Tasks

## 1. Web — quadrant overflow (apps/web)

- [x] 1.1 In `slides/lead-unified-slide.tsx`, make the quadrant rows scrollable.
      REVIEW-CORRECTED structure: the `QuadrantCard` `<section>` stays
      `overflow-hidden` (so the decorative corner watermark, which has negative
      offsets, is clipped and never turns `overflow-y:auto` into a phantom
      cross-axis scrollbar), and an INNER container
      (`flex h-full min-h-0 flex-col overflow-y-auto`) holds the header + rows and
      scrolls when dense. Move the per-quadrant floor OFF the card and onto the
      grid track: `auto-rows-[minmax(var(--slide-quadrant-min),1fr)]` so the floor + equal distribution live on the track. Keep the stripe, the dashed empty
      placeholder, and the fullscreen `dvh` behaviour. (The naive "card itself
      uses overflow-y-auto" caused a ~12px 2-axis phantom scroll from the
      watermark — caught + fixed in adversarial review, verified in Chromium.)
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
- [x] 4.2 Live (2026-06-22, lead1 on :3000): verified BOTH cases in the real app.
      Sparse Summary renders the four quadrants filling their equal zones cleanly
      (screenshot); fullscreen works (change B). DENSE (one product loaded to 6
      Current-Week records via the real Add-Item dialog): the Current Work quadrant
      FRAME stays `overflow:hidden` with hPhantom = 0 (NO horizontal phantom — the
      review-caught watermark regression), while the INNER container scrolls
      vertically (`scrollHeight - clientHeight = 361`px, hPhantom 0) so every row is
      reachable inside the equal zone. The only visible horizontal-phantom elements
      are `sr-only` a11y nodes (clip technique, harmless). DB restored to small after.
- [x] 4.3 `openspec validate fix-lead-slide-quadrant-overflow --strict`.
