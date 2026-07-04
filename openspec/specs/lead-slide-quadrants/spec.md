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

### Requirement: Records group under a single product heading within each quadrant

The lead "Own" slide MUST group each quadrant's rows by product under one neutral
product heading per group, rather than tagging every row with a repeated product
badge. `LeadUnifiedSlide` (`apps/web/src/components/slides/lead-unified-slide.tsx`,
fed by `buildUnifiedSlideModel` in
`apps/web/src/components/slides/section-slide-utils.ts`) MUST render, within each
quadrant, a single neutral product heading (muted fill, truncated product name,
`title` carrying the full name) followed by that product's rows. The old
fixed-width per-row product-name column MUST NOT return, and the repeated per-row
product badge MUST NOT return. A product heading MUST carry no status color — a
status hue beside records reads as their own severity (`status-color-semantics`),
the same rule the removed per-row badge carried; status stays exclusively on the
hero chip strip's dots. With exactly one real product, the quadrant rows MUST
render flat with no product heading. Rows from the `cross-product` pseudo-entry
MUST group under a single "Shared context" heading and MUST NOT appear in the
hero chip strip. Grouping MUST preserve the overflow contract of the strict-2×2
requirement: every row still renders (no count-based "+N more" truncation), a
quadrant that overflows its zone scrolls internally, and product-count overflow
paginates across the existing slide carousel (`paginateSectionSlides`) — grouping
introduces no silent truncation.

#### Scenario: a multi-product slide renders grouped rows

- **WHEN** the slide aggregates two or more real products and a quadrant holds
  rows for more than one of them
- **THEN** each product's rows sit under a single neutral product heading naming
  that product
- **AND** no row carries a per-row product badge and no fixed-width product-name
  column is drawn
- **AND** the heading carries no status color

#### Scenario: a single-product slide renders flat

- **WHEN** the slide has exactly one real product
- **THEN** the quadrant rows render flat with no product heading

#### Scenario: cross-product rows group under Shared context

- **WHEN** a quadrant holds `cross-product` pseudo-entry rows
- **THEN** those rows group under a single "Shared context" heading
- **AND** "Shared context" never appears in the hero chip strip

#### Scenario: a grouped quadrant overflows its zone

- **WHEN** a quadrant's grouped rows exceed its zone height inside the
  fixed-aspect `.slide-frame`, or the section holds more products than fit one
  slide page
- **THEN** the quadrant scrolls internally and every row stays reachable, and the
  extra products paginate across the slide carousel
- **AND** no "+N more" truncation is introduced by grouping

### Requirement: The lead slide reads lead, then priorities, then product

The lead "Own" slide MUST present its content in a lead → priorities → product
reading order. The author (lead) identity MUST be shown on the slide — the owning
lead's name in the slide hero (`LeadSlideHero`, above the quadrant grid in
`apps/web/src/components/slides/status-slide-deck.tsx`) — so a reader can
attribute the slide to its author without inspecting the URL. Within a product
group, priority-ranked records MUST surface before unranked records (ascending
rank, unranked last, stable order), so a P1 record never renders below a
lower-ranked one; records then read grouped by product per the grouping
requirement. This ordering MUST hold in both the all-products view and a
chip-scoped single-product view.

#### Scenario: the slide attributes itself to its author

- **WHEN** the lead "Own" slide renders
- **THEN** the owning lead's name is shown in the slide hero

#### Scenario: ranked records precede unranked within a group

- **WHEN** a product group holds both priority-ranked and unranked records in a
  quadrant
- **THEN** the ranked records render above the unranked ones, ascending by rank
- **AND** a lower-numbered priority (e.g. P1) never renders below a
  higher-numbered one (e.g. P3)

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
The per-product headings introduced by the grouping requirement are also
neutral and carry no status color (they replace the former per-row
badges, which this change removed).

#### Scenario: the slide renders all four quadrants with mixed content

- **WHEN** the slide renders quadrants, stripes, product headings, and
  priority chips together
- **THEN** all section headers and product headings are neutral-colored
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
