## REMOVED Requirements

### Requirement: Product attribution uses neutral identity badges

**Reason**: Live walkthrough 2026-07-02 (annotations A1): in the Summary
quadrants every row repeated the same product pill (e.g. "Маркетинговый портал"),
which reads as noise once a quadrant holds several rows of one product. The
per-row badge attribution is replaced by product GROUPING — one product heading
per group — so identity is stated once per product, not on every row.

**Migration**: The rows of a quadrant now group under a single neutral product
heading (see the added requirement "Records group under a single product heading
within each quadrant"). The heading keeps the same neutral, status-free,
truncated-with-`title` treatment the per-row badge had, and the ban on the old
fixed-width product-name column and on status-colored row markers carries over
into the new requirement. Single-product slides still render flat with no
heading; `cross-product` rows now group under one "Shared context" heading
instead of a per-row "Shared context" badge.

## ADDED Requirements

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

## MODIFIED Requirements

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
