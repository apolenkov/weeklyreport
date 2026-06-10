## ADDED Requirements

### Requirement: The lead "Own" slide renders a strict 2×2 quadrant grid of framed cards

`LeadUnifiedSlide` (`apps/web/src/components/slides/lead-unified-slide.tsx`)
MUST render its four sections (Current Work | Next Focus over Risks |
Decisions) as a strict 2×2 grid of framed cards: each quadrant is a real
bordered card (existing card tokens) with a left status stripe and a
per-quadrant minimum height drawn from a named dimension token. An empty
quadrant MUST render a dashed-border placeholder with quadrant-specific
copy — it MUST NOT collapse to a bare section header. The fullscreen
behavior of the grid wrapper MUST be preserved.

#### Scenario: a quadrant has no items

- **WHEN** the unified slide model has zero rows for a section
- **THEN** that quadrant still renders as a framed card at the minimum
  height
- **AND** a dashed placeholder names the empty state (e.g. "No risks
  raised")

#### Scenario: content is unevenly distributed

- **WHEN** one quadrant has many rows and its neighbor has none
- **THEN** all four quadrants render as visually equal framed zones
- **AND** rows cap at the section limit with a "+N more" overflow line

### Requirement: Product attribution is single-sourced via legend and status dots

Product identity on the lead "Own" slide MUST be established once by the
hero chip strip (`SlideProductChips`) acting as the legend, plus a compact
status-colored dot per row — the per-row product-name column MUST NOT
exist. Dot colors MUST come from the same status→color mapping the legend
uses (single-sourced, exported from `slide-product-chips.tsx`). With a
single real product, rows render flat: no dots and no legend. Rows from
the `cross-product` pseudo-entry carry the muted "empty" dot and never
appear in the legend.

#### Scenario: a multi-product slide renders rows

- **WHEN** the slide aggregates two or more real products
- **THEN** each row leads with an 8px dot colored by that product's worst
  status, identical to the legend chip color
- **AND** no row repeats the product name as a text column

#### Scenario: a single-product slide renders rows

- **WHEN** the slide has exactly one real product
- **THEN** rows render without dots and the legend is not shown

### Requirement: Row dots carry non-color cues

Because dot hue alone fails color-blind users (WCAG 1.4.1), every row dot
MUST carry the product name via `title` and a visually-hidden (`sr-only`)
text node. The gold `P{n}` priority chip remains the rank cue and MUST
NOT be repurposed for product attribution.

#### Scenario: a screen reader visits a row

- **WHEN** assistive technology reads a multi-product row
- **THEN** the product name is announced from the visually-hidden text
- **AND** a sighted user can hover the dot to see the product name

### Requirement: Quadrant colors stay inside the existing status system

Quadrant stripes, headers, and dots MUST use existing named tokens:
section headers render neutral (muted foreground, hierarchy via
typography weight); the Risks stripe uses the amber at-risk accent; red
appears only on dots of blocked products; gold stays reserved for the
priority chip. Any status color the slide introduces MUST resolve through
a named `--color-*` token (per `status-color-semantics`), including the
at-risk dot value, which MUST be referenced via a named token rather than
an inline hex literal.

#### Scenario: the slide renders all four quadrants with mixed content

- **WHEN** the slide renders quadrants, stripes, dots, and priority chips
  together
- **THEN** all section headers are neutral-colored
- **AND** red appears only on blocked-product dots
- **AND** every status color resolves through a named token
