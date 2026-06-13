# Slides: Product Pick Auto-Fits the Lead Slide

## Why

User feedback (2026-06-11, `/lead/report/<id>?mode=slides`): when
picking a product via the chip strip, the slide content should
auto-align across the whole frame — «авто-выравнивание по всему
слайду, по аналогии как когда тему добавляем» (the same rebalance the
slide already shows when a theme/item is added). Investigation shows
the chips are inert today: `LeadSlideArticle` renders
`SlideProductChips` without `activeProductId`/`onSelect`
(`status-slide-deck.tsx:171-173`), so the `role="tab"` buttons with
hover styles do nothing. And the slide frame is aspect-fixed
(`--slide-aspect: 16/10`, `overflow: hidden` —
`packages/ui/src/styles/globals.css:281-284`) while the quadrant grid
floor is viewport-relative (`min-h-[52dvh]`,
`lead-unified-slide.tsx:142`), so sparse content leaves a dead bottom
band inside the frame.

Note: the brief named `rotateIfNeeded` as prior slide auto-fit art;
the only `rotateIfNeeded` in the repo is log-file rotation
(`apps/api/src/lib/logger.ts:115`) — a name collision. The real prior
art is the quadrant grid's `auto-rows-fr` + min-height-floor
distribution from `redesign-lead-slide-quadrants`.

## What Changes

1. Wire chip selection on the lead slide article: clicking a chip
   scopes the unified quadrant slide to that product's rows; clicking
   the active chip again returns to all products. Pure model filter in
   `section-slide-utils.ts`, applied before `buildUnifiedSlideModel`.
2. Frame-fill layout: the quadrant grid stretches to the remaining
   height of the fixed-aspect `.slide-frame` (flex column; grid takes
   the leftover), replacing the viewport-relative `52dvh` floor on
   this surface. `auto-rows-fr` then redistributes quadrants on every
   content change — product pick and theme-add behave identically.
3. Unit tests for the filter helper; component tests for chip
   toggle/aria-selected and the filtered render.

**Non-goals:** no font auto-scaling or content-to-fit text shrinking;
no head-deck chips (display-only there stays); no changes to the
"By product" `LeadProductGrid` scope view; no new color tokens.

## Open Questions

The feedback is one sentence; these need user sign-off (conservative
defaults chosen in `design.md` are implementable without re-asking):

1. Filter vs highlight: does picking a chip hide other products' rows
   (assumed) or only highlight/scroll to them?
2. Deselect affordance: toggle by re-clicking the active chip
   (assumed) or an explicit "All products" chip?
3. Hero KPI counts stay section-global while filtered (assumed) or
   re-count for the picked product?
4. Dense-content overflow: the frame still clips silently when one
   product overflows; is a follow-up scale/paginate change wanted?
5. Should the head deck eventually get the same interactive chips
   (separate change)?

## Capabilities

### Modified Capabilities

- `lead-slide-quadrants`: ADDED requirement — the chip strip becomes
  an interactive product filter and the quadrant grid always fills the
  slide frame (no dead bottom band) on any content change.

## Impact

- `apps/web/src/components/slides/section-slide-utils.ts` (+ tests) —
  pure product-scope filter.
- `apps/web/src/components/slides/status-slide-deck.tsx` —
  `LeadSlideArticle` chip state + frame-fill wrapper.
- `apps/web/src/components/slides/lead-unified-slide.tsx` — height
  floor becomes frame-relative on the framed surface.
- `apps/web/src/components/slides/slide-product-chips.tsx` — no API
  change expected (props already exist).
- Purely frontend/presentational; no API, schema, or Prisma work.
