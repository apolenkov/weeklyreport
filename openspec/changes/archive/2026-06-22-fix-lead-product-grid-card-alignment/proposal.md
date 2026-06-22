# Align the per-product slide grid so section blocks sit on one level

## Why

In the lead slides PRODUCT scope, the per-product cards "float": the
current/next/risks/decisions blocks start at different vertical positions across
cards in the same row, so the eye can't scan across (live feedback, 2026-06-20:
"блоки … на одном уровне, чтобы не летало"; the user confirmed 2026-06-21 this is
the product grid, not the Summary view, which is already level).

Cause (verified in `apps/web/src/components/slides/lead-product-grid.tsx`): the
outer grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (line 181) has NO shared
row track, and each `ProductCard` is `flex h-full flex-col` (line 110) with
`mt-auto` pinning the Risks/Decisions block to the card bottom (line 127). Cards
stretch to equal height, but the Current/Next sections have different intrinsic
heights and the Risks/Decisions block floats to the bottom behind a variable gap —
and cards with no risks/decisions omit the block entirely — so no section shares a
baseline across cards.

## What Changes

Make the four section bands — header, Current, Next, Risks+Decisions — share a
horizontal baseline across every card in a row, using CSS **subgrid**: the outer
grid defines the row tracks and each card adopts `grid-template-rows: subgrid`
spanning them, so every card's "Current" / "Next" / "Risks+Decisions" begins at
the same Y. To share tracks, each card MUST always render all four bands (an empty
band renders a quiet placeholder, never collapses). The `mt-auto` bottom-pin is
removed (subgrid alignment replaces it). The `MAX_VISIBLE_ITEMS` (= 3) "+N more"
truncation stays — it bounds each band's height so the shared tracks stay compact.

## Non-goals

- The Summary view (`LeadUnifiedSlide`) is already level (`auto-rows-fr`) — out of
  scope.
- No change to the `MAX_VISIBLE_ITEMS` truncation count or to record content.
- No change to the per-quadrant overflow work (`fix-lead-slide-quadrant-overflow`)
  — that is the Summary surface.
- No DB / API / shared-schema change.

## Capabilities

- `lead-product-grid-alignment` — ADDED: per-product cards align their section
  bands across a row via subgrid; all four bands always render.
