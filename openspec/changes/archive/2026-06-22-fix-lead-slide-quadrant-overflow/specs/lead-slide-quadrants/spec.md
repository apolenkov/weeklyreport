## MODIFIED Requirements

### Requirement: The lead "Own" slide renders a strict 2×2 quadrant grid of framed cards

The lead "Own" slide MUST render its four sections (Current Work | Next Focus over Risks | Decisions) as a strict 2×2 grid of framed cards. `LeadUnifiedSlide` (`apps/web/src/components/slides/lead-unified-slide.tsx`) draws each quadrant as a real bordered card (existing card tokens) with a left status stripe and a per-quadrant minimum height drawn from a named dimension token. An empty quadrant MUST render a dashed-border placeholder with quadrant-specific copy — it MUST NOT collapse to a bare section header. When a quadrant's rows exceed its rendered zone height, the quadrant MUST make the row overflow reachable via vertical scroll in a content container (`overflow-y:auto` plus `min-height:0`) that scrolls within its grid row instead of expanding it; the ROWS MUST NOT be clipped or unreachable (that would contradict the "every row renders" rule below). The card FRAME MAY keep `overflow:hidden` solely to clip purely-decorative chrome (the low-opacity corner watermark, which has negative offsets) — this is REQUIRED so the decorative element does not turn `overflow-y:auto` into a phantom cross-axis scrollbar on every card — PROVIDED the scrollable rows live in the inner content container, not the clipped frame. The card MUST NOT expand its `auto-rows-fr` row — the overflow scrolls INSIDE the equal row — so the "visually equal framed zones" and "fills its frame" invariants below are preserved (the scroll is contained within the equal quadrant, it does not resize the grid). The per-quadrant `--slide-quadrant-min` floor MUST be carried by the grid track (`grid-auto-rows: minmax(var(--slide-quadrant-min), 1fr)`) rather than the card, so the floor coexists with the card's `min-height:0` (the two cannot both sit on the card's `min-height`). The fullscreen behavior of the grid wrapper MUST be preserved.

#### Scenario: a quadrant has no items

- **WHEN** the unified slide model has zero rows for a section
- **THEN** that quadrant still renders as a framed card at the minimum
  height
- **AND** a dashed placeholder names the empty state (e.g. "No risks
  raised")

#### Scenario: content is unevenly distributed

- **WHEN** one quadrant has many rows and its neighbor has none
- **THEN** all four quadrants render as visually equal framed zones
- **AND** every row renders — no count-based truncation (user direction
  2026-06-10: "+N more" is not acceptable on this slide)

#### Scenario: a quadrant overflows its zone

- **WHEN** a quadrant has more rows than fit in its zone height inside the fixed-aspect `.slide-frame`
- **THEN** the quadrant becomes vertically scrollable inside its framed card (`overflow-y:auto`; the card does not expand its `auto-rows-fr` row) and every row stays reachable
- **AND** the overflow is NOT clipped by `overflow:hidden` and no "+N more" truncation is introduced
- **AND** the other quadrants keep their equal `auto-rows-fr` zones and `--slide-quadrant-min` floor
