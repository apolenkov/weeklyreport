# lead-slide-by-product-grid Specification

## Purpose

The status slide deck uses one by-product article for lead, head, and viewer
presentation surfaces. The article replaces the old fixed-frame quadrant and
separate product-grid layouts with an auto-height canvas: header, priorities,
one shared column-header row, product cards, contributors, and stage legend. It
governs the slide article itself; shell-level scope controls and navigation stay
owned by the report surfaces.

## Requirements

### Requirement: One slide article renders every deck slide

The status deck MUST render every slide, including lead sections and the head's
own section, through the single `SlideArticle` path under
`apps/web/src/features/slides/ui/status-slide-deck.tsx` on head present mode,
viewer present mode, and the lead slides surface. The deck MUST NOT keep a
separate head-slide, quadrant, or product-grid article.

#### Scenario: head section slide uses the same layout

- **WHEN** the deck reaches the head's own section slide
- **THEN** it renders with the identical by-product grid article used for lead
  slides

### Requirement: Slide reading order is header, priorities, column headers, products

The slide MUST present, top to bottom: the header row, the priority-card strip,
one column-header row (Current work / Next focus / Risks / Decisions), then one
card per product. Column headers MUST NOT repeat inside product cards. DOM order
MUST equal visual order (Current work, Next focus, Risks, Decisions) so assistive
technology reads columns in the visual sequence.

#### Scenario: column headers render once

- **WHEN** a slide shows three products
- **THEN** exactly one column-header row renders above the first product card
- **AND** no product card repeats the column headers

#### Scenario: screen reader order matches visual order

- **WHEN** a subsection row is traversed in DOM order
- **THEN** cells are encountered as Current work, Next focus, Risks, Decisions

### Requirement: Header summarizes the owner's period

The header MUST show: a worst-status pill derived from all product statuses on
the slide, the owner's name, counters for current items, risks, and priorities,
and an "N of M products on track" chip that uses the alert tint while N is less
than M and the neutral/positive treatment when N equals M. Deck-owned controls
MAY render at the end of the header, but mode/scope ownership stays outside the
article. All colors MUST come from existing design tokens.

#### Scenario: worst status wins the pill

- **WHEN** the slide has products on track and one blocked product
- **THEN** the header pill shows the blocked treatment

#### Scenario: all products on track

- **WHEN** every product with data is on track
- **THEN** the "N of M products on track" chip drops the alert tint

### Requirement: Canvas is auto-height with a bounded width

The slide canvas MUST be centered with `max-width: 1088px`, a minimum width of
approximately `900px` below which the container scrolls horizontally, a minimum
height of `680px`, and height that grows with content. Content MUST NOT be
clipped and no count-based truncation (`+N more`) is allowed. In fullscreen, a
slide taller than the viewport MUST be reachable by vertical scroll.

#### Scenario: dense slide grows instead of clipping

- **WHEN** a section holds more records than fit within `680px`
- **THEN** the slide grows vertically and every record renders

#### Scenario: fullscreen overflow scrolls

- **WHEN** a grown slide is presented fullscreen on a shorter viewport
- **THEN** the slide content scrolls vertically and stays fully reachable

### Requirement: Priority strip shows all ranked items

The priority strip MUST render one card per item carrying a `priorityRank`,
across all products on the slide; risks and decisions MUST NOT enter the strip.
Cards order by ascending rank; on equal rank the lead's items come first. Ranks
are personal, so two P1 cards from different authors are valid. Each card MUST
show the P-badge tinted with the author's color, the full item text wrapping
without truncation, the product name, and the author's initials badge.

#### Scenario: two P1s from different authors

- **WHEN** the lead and a contributor each have a rank-1 item
- **THEN** both cards render, with the lead's card first

#### Scenario: risks never enter the strip

- **WHEN** a slide has risks and zero ranked items
- **THEN** the priority strip renders nothing

### Requirement: Product cards carry status by color only

Each product card MUST show its status as a left stripe and a status dot beside
the product name, using existing status tokens; textual status chips MUST NOT
appear on the card. A product with no data for the period MUST render as a
collapsed dashed-border row reading "no status for this period". Products with
no status MUST render without a status stripe.

#### Scenario: blocked product card

- **WHEN** a product's derived status is blocked
- **THEN** its card shows the blocked-token stripe and dot
- **AND** no textual status chip appears on the card

#### Scenario: product without data collapses

- **WHEN** a product assigned to the owner has no records this period
- **THEN** it renders as a collapsed dashed row with the no-status copy

### Requirement: Subsections share one four-column grid

Inside a product card, subsections MUST order Product-level first, then one
subsection per project. Every subsection row MUST use the same shared grid
template (`1.15fr 1fr 1.1fr 1fr`) so columns align vertically across the whole
slide. Subsections separate with a dashed top border. A project subsection
header MUST show a branch icon, the project's status dot, and the project name
uppercase; it MUST NOT show a textual project status badge. An empty cell MUST
render an em dash placeholder.

#### Scenario: columns align across products

- **WHEN** two product cards render subsection rows
- **THEN** their four columns share the same horizontal boundaries

#### Scenario: empty cell placeholder

- **WHEN** a project has no decisions
- **THEN** its Decisions cell renders an em dash placeholder

### Requirement: Item rows attribute author, priority, status, and stage

An item row MUST show, in order: the author initials badge, an optional priority
badge, the wrapping item text, a status badge, and SDLC stage watermark icons.
Author colors come from a deterministic cycle of existing tokens assigned per
slide with the lead always first; the full name lives in the badge's `title`.
In a run of consecutive rows by the same author within one cell, only the first
row shows the badge; following rows keep an invisible spacer of equal width. The
status badge map MUST stay open for future statuses and currently renders:
COMPLETED and IN PROGRESS for current work, PLANNED for next focus, and AT RISK
for risks with `riskSeverity: "at-risk"`. A risk with
`riskSeverity: "blocked"` MUST render with the row highlight treatment and no
status badge; blocker emphasis MUST NOT appear outside the Risks column.

#### Scenario: consecutive same-author rows collapse the badge

- **WHEN** one cell holds three consecutive items by the same contributor
- **THEN** only the first row shows the initials badge
- **AND** the next two keep an equal-width spacer

#### Scenario: blocked risk highlights

- **WHEN** a risk has severity `blocked`
- **THEN** its row gets the highlight treatment, shows no AT RISK badge, and
  keeps stage icons on the shared vertical

### Requirement: Stage watermarks and cell ordering follow the canonical stage order

Item rows at product level MUST show their SDLC stages as low-opacity watermark
icons positioned at the row's bottom-right, one icon per stage, reusing
`STAGE_ICONS` from
`apps/web/src/features/report-sections/model/stage-chip-config.ts` with the
stage name in a `title` tooltip; rows inside project subsections render without
stage icons. Rows within a cell MUST sort by the item's first stage index in
`STAGE_NAMES` (`packages/shared/src/schemas/stage-names.ts`), then by author with
the lead first; the sort MUST be stable.

#### Scenario: multi-stage item

- **WHEN** a product-level item carries the Development and Support stages
- **THEN** both watermark icons render side by side at the row's bottom-right

#### Scenario: cell sorts by stage then author

- **WHEN** a cell holds a Support-stage item by the lead and a Planning-stage
  item by a contributor
- **THEN** the Planning item renders first

### Requirement: Legend names contributors with optional roles

The slide footer MUST render a legend listing each contributor: initials badge
in the contributor's assigned color, full name, and "role" suffix only when
`authorRole` is present. When a contributor has no role, the suffix MUST be
omitted entirely; no placeholder is allowed.

#### Scenario: contributor without a role

- **WHEN** a legend entry's author has no `authorRole`
- **THEN** the entry shows only the badge and name

### Requirement: Product and lead scopes reuse the same article layout

Consuming shells MUST own Product/Leads scope selection instead of introducing a
second article layout. In Product scope, the deck groups sections into one slide
per product. In Leads scope, the deck renders one slide per lead section. Both
scopes MUST feed the same `SlideArticle` layout and MUST NOT introduce a
separate Product-mode card grid.

#### Scenario: scoping to products

- **WHEN** the head or viewer surface is in Product scope
- **THEN** each active slide renders through the same by-product article layout

#### Scenario: scoping to leads

- **WHEN** the head or viewer surface is in Leads scope
- **THEN** each active slide renders through the same article layout, with no
  separate lead-specific article
