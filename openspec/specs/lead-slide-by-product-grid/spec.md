# lead-slide-by-product-grid Specification

## Purpose

The status slide deck uses one by-product article for lead, head, and viewer
presentation surfaces. The article renders an auto-height canvas with a header,
priorities,
one shared column-header row, product cards, contributors, and stage legend. It
governs the slide article itself; shell-level scope controls and navigation stay
owned by the report surfaces.

## Requirements

### Requirement: Deep-linked lead history reports remain addressable

When the lead slide route contains an explicit report id, the route MUST use
that id as the by-period read candidate even when it is older than the bounded
history selector page. The scoped API read MUST decide whether the report is
available; an invalid or unauthorized id MUST surface an unavailable/error
state and MUST NOT silently fall back to the active report.

#### Scenario: Older report deep link

- **WHEN** a lead opens a report id beyond the first history page
- **THEN** the by-period query requests that exact id
- **AND** the UI does not substitute the active report

#### Scenario: Invalid deep link

- **WHEN** the explicit report id is invalid or inaccessible
- **THEN** the route shows the typed unavailable/error state
- **AND** the active report is not rendered as a substitute

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

The slide canvas MUST be centered with the `--slide-canvas-max-w` token (`100%`),
use the `--slide-canvas-min-w` token (`900px`) so narrower containers scroll
horizontally, and use the `--slide-canvas-min-h` token (`360px`) while growing
with content. Content MUST NOT be
clipped and no count-based truncation (`+N more`) is allowed. In fullscreen, a
slide taller than the viewport MUST be reachable by vertical scroll.

#### Scenario: dense slide grows instead of clipping

- **WHEN** a section holds more records than fit within the `360px` minimum
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

### Requirement: Product cards expose status without relying on color

Each product card MUST retain the status-colored left stripe and MAY show a
shape-distinct compact status glyph. On Track, At Risk, and Blocked MUST have
distinguishable glyph shapes when a glyph is rendered, and the corresponding
English status label MUST be available to assistive technology as an `sr-only`
label; status words MUST NOT consume visible card space beside the product name.
A product with no data for the period MUST render as a collapsed dashed-border
row reading "no status for this period" and MUST render without a status stripe
or status glyph.

#### Scenario: Blocked product has redundant status channels

- **WHEN** a product's derived status is blocked
- **THEN** its card shows the blocked stripe and, when present, the distinct blocked glyph
- **AND** assistive technology announces `Blocked` through the glyph's hidden label without relying on color

#### Scenario: Statuses remain distinguishable without color

- **WHEN** on-track, at-risk, and blocked product cards are viewed without color information
- **THEN** their compact icons remain shape-distinct
- **AND** each rendered glyph exposes its corresponding `On Track`, `At Risk`, or `Blocked` accessible text
- **AND** those status words are not visible beside the product name

#### Scenario: Product without data collapses

- **WHEN** a product assigned to the owner has no records this period
- **THEN** it renders as a collapsed dashed row with the no-status copy
- **AND** it renders no status stripe or status icon

### Requirement: Subsections share one four-column grid

Inside a product card, subsections MUST order Product-level first, then one
subsection per project. Every subsection row MUST use the same shared grid
template (`1.35fr 1.25fr 0.85fr 0.85fr`) so columns align vertically across the whole
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

An item row MUST show the author initials badge, the wrapping item text, and
SDLC stage watermark icons where applicable. Status MUST be communicated by the
row's quiet frame tone and, when mapped, an optional shape-distinct glyph; its
English status label MUST be `sr-only` and available through the row's
accessible/hover description. Status words MUST NOT be rendered as visible
badges in the row.
Author colors come from a deterministic cycle of existing tokens assigned per
slide with the lead always first; the full name lives in the badge's `title`.
In a run of consecutive rows by the same author within one cell, only the first
row shows the badge; following rows keep an invisible spacer of equal width. The
item status tone/glyph map MUST be exhaustive over the validated
`ItemWorkflowStatus` contract (`planned | in_progress | paused | postponed |
done`) and MUST reuse the canonical status mapping for own and foreign rows.
An unvalidated or unknown item status MUST be rejected before rendering; no
neutral or PLANNED compatibility fallback is allowed. Current work, next focus,
and risks use their canonical tone/glyph mappings, while risk severity remains
in the row frame. A risk with `riskSeverity: "blocked"` MUST render with the
row highlight treatment and no visible status badge; blocker emphasis MUST NOT
appear outside the Risks column.

Each item row MAY intentionally clamp its body to two lines to keep the grid
compact, but MUST expose the complete status-and-text description through its
hover tooltip and accessible edit label. Clamping MUST NOT remove a source row;
all rows remain present in Document density and all rows/pages remain present
exactly once in Presentation density.

#### Scenario: consecutive same-author rows collapse the badge

- **WHEN** one cell holds three consecutive items by the same contributor
- **THEN** only the first row shows the initials badge
- **AND** the next two keep an equal-width spacer

#### Scenario: clamped text remains available

- **WHEN** an item text exceeds two lines in a slide row
- **THEN** the visible body is clamped to two lines
- **AND** the complete text and status remain available through the row tooltip
- **AND** the source item is not dropped from the document or presentation pages

#### Scenario: blocked risk highlights

- **WHEN** a risk has severity `blocked`
- **THEN** its row gets the highlight treatment, shows no visible status badge, and
  keeps stage icons on the shared vertical

### Requirement: Stage watermarks and cell ordering follow the canonical stage order

Item rows at product level MUST show their SDLC stages as low-opacity inline
icons before the item text, one icon per stage, reusing
`STAGE_ICONS` from
`apps/web/src/features/report-sections/model/stage-chip-config.ts` with the
stage name in a `title` tooltip; rows inside project subsections render without
stage icons. Rows within a cell MUST sort by the item's first stage index in
`STAGE_NAMES` (`packages/shared/src/schemas/stages/stage-names.ts`), then by author with
the lead first; the sort MUST be stable.

#### Scenario: multi-stage item

- **WHEN** a product-level item carries the Development and Support stages
- **THEN** both stage icons render side by side before the item text

#### Scenario: cell sorts by stage then author

- **WHEN** a cell holds a Support-stage item by the lead and a Planning-stage
  item by a contributor
- **THEN** the Planning item renders first

### Requirement: Legend names contributors with their roles

The slide footer MUST render a legend listing each contributor: initials badge
in the contributor's assigned color, full name, and the persisted `authorRole`
suffix. Every current cross-author content row MUST carry a valid `DbRole`;
missing roles are invalid input and MUST NOT be represented by a placeholder.

#### Scenario: contributor role is rendered

- **WHEN** a legend entry's author has `authorRole: "viewer"`
- **THEN** the entry shows the badge, name, and `viewer` role suffix

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

### Requirement: Presentation density paginates every product record

The slide deck MUST offer an explicit Presentation density that pages by
product and caps records per view with deterministic continuation pages, while
the existing Document density keeps the auto-height all-content article.
Presentation density MUST preserve every record exactly once, product/record
order, author attribution, status, and Mine/Everyone scoping.

#### Scenario: One product exceeds the presentation cap

- **WHEN** a product contains more records than one presentation view allows
- **THEN** the model creates labeled continuation pages for that product
- **AND** flattening the pages yields every source record identity exactly once in source order

#### Scenario: The user switches density

- **WHEN** the viewer switches between Document and Presentation
- **THEN** the control exposes the active mode and is reversible
- **AND** no report data is re-fetched or discarded solely because density changed

#### Scenario: Document density remains available

- **WHEN** a slide is used for document reading or print-oriented review
- **THEN** the auto-height article continues to render all products and records without count-based truncation

### Requirement: Slide author marks reflect the selected author scope

The lead slide grid MUST use author marks only where they distinguish contributors. In the single-author Mine scope, rows, priority cards, and the contributor legend MUST NOT repeat the selected deck author's initials because the slide header already establishes ownership. In Everyone or another multi-author scope, rows MUST show the existing stable author marks at the first row of each consecutive author series for both the selected owner and contributors; priority cards and the legend MUST carry the same identity.

#### Scenario: a lead views their own Mine slide

- **WHEN** the lead slide deck is scoped to Mine and every row belongs to the selected deck owner
- **THEN** the rows and priority cards render without the owner's repeated initials badges or empty badge spacers
- **AND** priority rank badges use a neutral rank background instead of an owner identity color
- **AND** an owner-only contributor legend is omitted instead of leaving an empty separator
- **AND** record status and stage marks keep their existing order and meaning

#### Scenario: a lead switches to Everyone

- **WHEN** the lead slide deck is scoped to Everyone
- **THEN** the first row of every consecutive author series shows that author's stable mark, including the selected owner
- **AND** priority cards and the contributor legend show their author marks
- **AND** priority rank badges retain their author identity color
- **AND** subsequent rows in the same consecutive series omit the repeated mark

#### Scenario: a multi-author slide is reviewed outside the lead Mine scope

- **WHEN** a head or viewer reviews content whose rows can belong to different authors
- **THEN** author marks remain visible and consistent with the contributor legend
