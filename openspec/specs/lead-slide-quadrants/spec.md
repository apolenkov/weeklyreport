## Purpose

The 2026-06-10 quadrant redesign (`redesign-lead-slide-quadrants`,
concept B chosen by the user, four live feedback rounds) replaced the
lead "Own" slide's floating columns with a framed 2×2 quadrant layout.
This capability fixes the durable layout and attribution properties so
the slide does not drift back to bare sections, per-row name columns, or
status-colored row markers. It governs the lead slide surface, not a
code module.

## Requirements

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

### Requirement: Product attribution uses neutral identity badges

Product identity on the lead "Own" slide MUST be carried by a compact
NEUTRAL badge per row (muted fill, truncated product name, `title` with
the full name) plus the hero chip strip above — the old fixed-width
product-name column MUST NOT return. Row badges MUST NOT carry status
colors: a status hue next to a row reads as that row's own severity
(user direction 2026-06-10, round 3 — replaced the earlier
status-colored dots). Status stays exclusively on the chip strip's dots.
With a single real product, rows render flat: no badges. Rows from the
`cross-product` pseudo-entry carry the "Shared context" badge and never
appear in the chip strip.

#### Scenario: a multi-product slide renders rows

- **WHEN** the slide aggregates two or more real products
- **THEN** each row leads with a neutral badge naming its product
- **AND** the badge carries no status color

#### Scenario: a single-product slide renders rows

- **WHEN** the slide has exactly one real product
- **THEN** rows render without badges

### Requirement: Quadrant colors stay inside the existing status system

Quadrant stripes and headers MUST use existing named tokens: section
headers render neutral (muted foreground, hierarchy via typography
weight); the Risks stripe uses the amber at-risk accent; the Decisions
stripe uses the blue `--color-decisions-accent` token (user sign-off
2026-06-10); red appears only on the chip strip's blocked-product dots;
gold stays reserved for the priority chip. Any status color the slide
introduces MUST resolve through a named `--color-*` token (per
`status-color-semantics`), including the at-risk chip dot value, which
MUST be referenced via a named token rather than an inline hex literal.

#### Scenario: the slide renders all four quadrants with mixed content

- **WHEN** the slide renders quadrants, stripes, badges, and priority
  chips together
- **THEN** all section headers are neutral-colored
- **AND** red appears only on the chip strip's blocked-product dots
- **AND** every status color resolves through a named token

### Requirement: Product chips scope the slide and content refills the frame

The product chip strip MUST act as a filter on the lead slide article
(`LeadSlideArticle`,
`apps/web/src/components/slides/status-slide-deck.tsx`): selecting a
chip scopes the unified quadrant slide to that product's rows, and
re-selecting the active chip restores all products. The selection MUST reset when the visible
slide page changes. While a product is selected, rows from the
`cross-product` pseudo-entry MUST NOT render. The chip strip's
`aria-selected` state MUST reflect the actual selection.

#### Scenario: a product chip is picked

- **WHEN** the lead slide aggregates two or more real products and one
  chip is clicked
- **THEN** the four quadrants render only that product's rows (empty
  quadrants keep their dashed placeholders)
- **AND** the picked chip is the only chip with `aria-selected="true"`

#### Scenario: the active chip is clicked again

- **WHEN** the currently selected product chip is clicked
- **THEN** the slide returns to the all-products view

#### Scenario: the slide page changes while a product is picked

- **WHEN** the user navigates to another slide page with a product
  selected
- **THEN** the new page renders unfiltered

### Requirement: The framed lead slide fills its frame on any content change

Inside the fixed-aspect `.slide-frame`, the quadrant grid MUST size
from the frame, not the viewport: hero and chip strip keep natural
height and the grid stretches over the remaining frame height, with
quadrants distributed evenly (`auto-rows-fr` semantics) and the named
`--slide-quadrant-min` per-quadrant floor preserved. Any content
change — picking or unpicking a product, adding a theme/item — MUST
redistribute the quadrants across the full frame; the slide MUST NOT
show a large empty band below the grid while the frame has unused
height.

#### Scenario: a sparse product is picked

- **WHEN** the picked product leaves only a few rows on the slide
- **THEN** the quadrant grid still spans the remaining frame height
- **AND** no dead bottom band appears inside the frame

#### Scenario: a theme is added to the section

- **WHEN** the section gains a new item and the slide re-renders
- **THEN** the quadrants redistribute evenly over the same frame
  height, identical in mechanism to the product-pick case
