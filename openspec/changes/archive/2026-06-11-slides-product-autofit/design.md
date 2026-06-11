# Design — Product Pick Auto-Fits the Lead Slide

## Context

Verified state (2026-06-11):

- `/lead/report/<id>?mode=slides` → `LeadForm` → `LeadSlidesClient` →
  `ReportSlides` → `StatusSlideDeck mode="lead"` → `LeadSlideArticle`
  (`status-slide-deck.tsx:141-178`) — the `article.slide-frame` the
  user measured at ~680px.
- `.slide-frame` = `aspect-ratio: var(--slide-aspect)` (16/10) +
  `overflow: hidden` (`packages/ui/src/styles/globals.css:281-284`).
  Height is derived from width, not from content.
- `SlideProductChips` already exposes `activeProductId` and
  `onSelect` (`slide-product-chips.tsx:13-14`) but no caller passes
  them — the strip is inert despite `role="tab"` + hover styles.
- `LeadUnifiedSlide` distributes content via
  `grid min-h-[52dvh] auto-rows-fr grid-cols-2`
  (`lead-unified-slide.tsx:142`). `auto-rows-fr` is what makes the
  "add a theme → rows rebalance" behavior the user wants to extend;
  the `52dvh` floor is viewport-relative, which inside a fixed-aspect
  frame under- or over-shoots and leaves the dead bottom band.
- The brief's `rotateIfNeeded` pointer is log rotation
  (`apps/api/src/lib/logger.ts:115`), not slide logic.

## Goals / Non-Goals

**Goals:** chip pick scopes the lead slide to one product; on every
content change (pick, unpick, theme added) the quadrants redistribute
to fill the frame with no large empty bottom; behavior is testable at
the model level.

**Non-Goals:** text auto-scaling / fit-to-frame font math (open
question 4); head deck interactivity; the `scope="product"` grid view;
pagination changes (`paginateSectionSlides` untouched).

## Decisions

### D1 — Selection state lives in `LeadSlideArticle`, keyed to the slide

`useState<string | null>(null)` inside `LeadSlideArticle`; an effect
(or `key` on the article content) resets it when `slide.id` /
`slide.pageIndex` changes, so a stale product from page 1 never
filters page 2. Lifting to `LeadSlidesClient` would spread one
surface's UI state across three layers for no consumer.

### D2 — Filter the model, not the rendered rows

A pure helper in `section-slide-utils.ts`:

`scopeSlideToProduct(slide: SectionSlideModel, productId: string | null): SectionSlideModel`

returns the slide with `productSlides` reduced to the picked product
(`null` → unchanged). It runs before `buildUnifiedSlideModel`, so
rows, empty-product placeholders, and badge gating all derive from one
source. The `cross-product` pseudo-entry is excluded while a product
is picked — its rows belong to no single product and it never appears
in the chip strip (existing invariant). KPI counts on the hero stay
section-global (open question 3; conservative default = no re-count).

### D3 — Frame-relative fill instead of the dvh floor

`LeadSlideArticle` becomes a column layout filling the frame: the
article (or its inner wrapper) gets `flex h-full flex-col`; hero and
chip strip keep natural height; the quadrant grid takes the remainder
(`flex-1 min-h-0`). Inside this surface the `min-h-[52dvh]` floor is
no longer the sizing source; the named `--slide-quadrant-min` token
floor per quadrant stays (durable spec requires it). `auto-rows-fr`
already equalizes the rows — no JS measurement, no ResizeObserver.
The non-framed/fullscreen path keeps its existing `dvh` behavior
unless it inherits the same fill for free.

### D4 — Toggle semantics + honest tabs a11y

Re-clicking the active chip clears the filter (single control, no new
"All" chip — open question 2 default). With selection wired,
`aria-selected` becomes truthful; when nothing is picked, no chip is
selected — acceptable for a filter-strip use of `role="tab"`, revisit
only if an a11y gate flags it.

## Invariants Touched

- `lead-slide-quadrants` — preserved: strict 2×2 framed grid, dashed
  empty placeholders, no count-based truncation, neutral badges,
  token-only colors. The delta only ADDS the interactive-chip +
  frame-fill requirement.
- `status-color-semantics` — untouched (no new colors).
- Single-product slides render no chip strip today
  (`productChips.length > 1` gate) — unchanged; filtering is
  meaningful only where the strip exists.

## Risks / Trade-offs

- [Sparse single-product pick] one row in a quadrant stretches over a
  tall card → acceptable: framed zones with watermarks were designed
  for sparse density (round-2 feedback precedent).
- [Dense single-product pick] still clips at the frame boundary —
  explicitly out of scope (open question 4), same behavior as today.
- [Snapshot churn] `status-slide-deck` snapshots will change; update
  to the new contract, never loosen assertions. The pre-existing
  uncommitted `product-accordion.test.tsx.snap` modification is
  unrelated — do not stage or revert it.
