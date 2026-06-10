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
- **AND** every row renders — no count-based truncation (user direction
  2026-06-10: "+N more" is not acceptable on this slide)

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
