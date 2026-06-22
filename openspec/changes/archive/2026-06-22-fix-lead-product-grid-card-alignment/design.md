# Design

## Context

`LeadProductGrid` (`apps/web/src/components/slides/lead-product-grid.tsx`) is the
PRODUCT-scope lead slide (one card per product). Today:

- outer grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (line 181) — no row track.
- `ProductCard`: `flex h-full flex-col gap-3` (line 110); header (line 111),
  `CardSection "Current"` (118), `CardSection "Next"` (122), then a CONDITIONAL
  `mt-auto … border-t` block holding Risks + Decisions (126-157) — rendered only
  when `hasRisks || hasDecisions`.
- `MAX_VISIBLE_ITEMS = 3` (42) caps each list with a "+N more" row.

Cards stretch to equal height (`align-items: stretch`), and `mt-auto` pins the
Risks/Decisions block to the bottom. So headers align (top) and the bottom block
roughly aligns (bottom), but the Current/Next sections — and the variable gap
above the bottom block — do not share a baseline, and cards lacking
risks/decisions drop the block entirely. That is the "floating".

## Decision — align section bands with CSS subgrid

**Chosen:** give the four section bands a shared baseline across a row via
subgrid. The outer grid defines four row tracks; each card spans them and inherits
them with `grid-template-rows: subgrid`, so band N starts at the same Y in every
card.

Concretely (implementation choice, verify live):

- Outer grid gains a row template so each card occupies a fixed set of bands —
  e.g. each `ProductCard` becomes `display: grid; grid-row: span 4;
grid-template-rows: subgrid` with bands: (1) header, (2) Current, (3) Next,
  (4) Risks+Decisions.
- Every card MUST render ALL FOUR bands so the tracks line up. An empty band
  renders a quiet placeholder (e.g. the existing "No risks" / "No decisions"
  empty text), NOT a collapsed/absent block. This replaces the conditional
  `hasRisks || hasDecisions` block and the `mt-auto` pin.
- `MAX_VISIBLE_ITEMS` truncation stays: it bounds each band's content height, so a
  subgrid track sized to the tallest card in the row stays compact (without it,
  one product with 10 items would inflate that band for every card).

**Browser support:** subgrid is supported in current target browsers (Chrome
117+, Firefox 71+, Safari 16+). The repo targets modern browsers (Next.js 16 /
React 19), so no fallback is required; if a non-subgrid fallback is ever needed,
fixed per-band `min-height`s give approximate alignment.

**Rejected:**

- Dropping `mt-auto` alone — Current/Next still vary, bands still don't align.
- Fixed per-band `min-height`s as the PRIMARY mechanism — brittle (guesses the
  tallest band) and wastes space; subgrid sizes tracks to content automatically.
- Forcing identical card content — not a layout fix.

## Invariants / impact

- View-layer only; no DB / API / shared-schema change.
- `MAX_VISIBLE_ITEMS` and the "+N more" affordance are unchanged (this is the
  Product-scope grid's existing truncation; distinct from the Summary's no-+N-more
  rule and from `SLIDE_SECTION_SOFT_CAP`).
- The Summary surface (`lead-slide-quadrants`) is untouched.

## Test strategy

- jsdom: render `LeadProductGrid` with products of UNEVEN section sizes; assert
  every card renders all four bands (including empty placeholders) and the card
  uses the subgrid row template (class assertion), and no card uses `mt-auto`.
- Live-verify the actual alignment across a row (jsdom cannot measure layout):
  with 3 products of different content volumes, the Current / Next /
  Risks+Decisions bands line up horizontally across the cards.
