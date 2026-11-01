# lead-slide-by-product-grid Specification

## Purpose

The status slide deck uses one by-product article for lead, head, and viewer
presentation surfaces. The article renders an auto-height canvas with responsive
category labels, product cards, a shared four-column subsection grid and item
rows in canonical stage order. The header, priority strip and contributor legend
live in [lead-slide-header-and-legend](../lead-slide-header-and-legend/spec.md);
density pagination, author marks and row text disclosure live in
[lead-slide-row-density](../lead-slide-row-density/spec.md). It governs the slide
article itself; shell-level scope controls and navigation stay owned by the
report surfaces.

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
then one card per product. At viewport widths of 640 CSS pixels or wider, one
shared column-header row (Current work / Next focus / Risks / Decisions) MUST
precede the product cards, and those headers MUST NOT repeat inside product
cards. Below 640 CSS pixels, the shared header row MUST be hidden and every
stacked subsection cell MUST have its own visible category label. DOM order
MUST equal visual order (Current work, Next focus, Risks, Decisions) so assistive
technology reads cells in the visual sequence.

#### Scenario: column headers render once

- **WHEN** a slide shows three products at 640 CSS pixels or wider
- **THEN** exactly one column-header row renders above the first product card
- **AND** no product card repeats the column headers

#### Scenario: Mobile cells retain their category context

- **WHEN** a slide shows product subsections below 640 CSS pixels
- **THEN** every stacked cell shows its Current work, Next focus, Risks, or Decisions label
- **AND** the detached shared four-column header row is not displayed

#### Scenario: screen reader order matches visual order

- **WHEN** a subsection row is traversed in DOM order
- **THEN** cells are encountered as Current work, Next focus, Risks, Decisions

### Requirement: Canvas is auto-height with a bounded width

The shared `SlideArticle`, activity fallback, and loading skeleton MUST use the
`--slide-canvas-max-w` token (`100%`) and the `--slide-canvas-min-h` token
(`360px`) while growing with content. At viewport widths of 640 CSS pixels or
wider, the canvas MUST retain the `--slide-canvas-min-w` token (`900px`) and
allow internal horizontal scrolling when its container is narrower. Below
640 CSS pixels, its minimum inline size MUST be zero and the canvas MUST fit
its container without horizontal content overflow. Titles, priority cards,
product names, contributor entries, and stage legends MUST wrap as needed.
Content MUST NOT be clipped and no count-based truncation (`+N more`) is
allowed. In fullscreen, a slide taller than the viewport MUST be reachable by
vertical scroll.

#### Scenario: Mobile slide fits its container

- **WHEN** a Lead or Head slide renders at 375 CSS pixels
- **THEN** its canvas fits the container without horizontal content overflow
- **AND** every priority, category, contributor entry, and stage legend remains reachable
- **AND** its loading skeleton uses the same responsive width contract

#### Scenario: dense slide grows instead of clipping

- **WHEN** a section holds more records than fit within the `360px` minimum
- **THEN** the slide grows vertically and every record renders

#### Scenario: fullscreen overflow scrolls

- **WHEN** a grown slide is presented fullscreen on a shorter viewport
- **THEN** the slide content scrolls vertically and stays fully reachable

### Requirement: Product cards expose status without relying on color

Each product card MUST retain the status-colored left stripe and MAY show a
shape-distinct compact status glyph. On Track, At Risk, and Blocked MUST have
distinguishable glyph shapes when a glyph is rendered, and the corresponding
English status label MUST be available to assistive technology. A product with
neither update rows, activity status, nor a derived product status MUST render
as a collapsed dashed-border row reading "no status for this period" and MUST
render without a status stripe or status glyph. A derived product status MUST
remain visible even when the product has no update rows.

#### Scenario: Blocked product has redundant status channels

- **WHEN** a product's derived status is blocked
- **THEN** its card shows the blocked stripe and, when present, the distinct blocked glyph
- **AND** assistive technology announces `Blocked` through the glyph's hidden label without relying on color

#### Scenario: Statuses remain distinguishable without color

- **WHEN** on-track, at-risk, and blocked product cards are viewed without color information
- **THEN** their compact icons remain shape-distinct
- **AND** each rendered glyph exposes its corresponding `On Track`, `At Risk`, or `Blocked` accessible text
- **AND** those status words are not visible beside the product name

#### Scenario: status exists without update rows

- **WHEN** a product has a derived status and no current-period update rows
- **THEN** its card renders the actual status treatment
- **AND** it does not claim that no status exists for the period

#### Scenario: Product without data collapses

- **WHEN** a product has no update rows, activity status, or derived status
- **THEN** it renders as a collapsed dashed row with the no-status copy
- **AND** it renders no status stripe or status icon

### Requirement: Subsections share one four-column grid

Inside a product card, subsections MUST order Product-level first, then one
subsection per project. At viewport widths of 640 CSS pixels or wider, every
subsection row MUST use the same shared four-column grid template
(`1.35fr 1.25fr 0.85fr 0.85fr`) so columns align vertically across the whole
slide. Below 640 CSS pixels, every subsection MUST use one column in the same
Current work, Next focus, Risks, Decisions order, with a visible local label
for every cell. Responsive reflow MUST preserve every source row and its
existing disclosure and edit behavior. Subsections separate with a dashed top border. A project subsection
header MUST show a branch icon, the project's status dot, and the project name
uppercase; it MUST NOT show a textual project status badge. An empty cell MUST
render an em dash placeholder.

#### Scenario: columns align across products

- **WHEN** two product cards render subsection rows at 640 CSS pixels or wider
- **THEN** their four columns share the same horizontal boundaries

#### Scenario: Mobile subsections stack without losing records

- **WHEN** a product subsection renders below 640 CSS pixels
- **THEN** its four labeled cells stack in canonical category order
- **AND** every record retains its identity, author, status, disclosure, and applicable edit action

#### Scenario: empty cell placeholder

- **WHEN** a project has no decisions
- **THEN** its Decisions cell renders an em dash placeholder

### Requirement: Item rows attribute author, priority, status, and stage

An item row MUST show the record author's initials badge in a dedicated
top-right metadata rail, wrapping item text at the stable left edge, and SDLC
stage watermark icons at the bottom-right where applicable. Every row MUST show
its author mark, including consecutive rows by the same author and owner rows in
Mine scope. An unresolved author MUST render the existing unknown-author mark;
the UI MUST NOT substitute a last editor or another inferred identity. Status
MUST be communicated by the row's quiet frame tone; its English status label
MUST be `sr-only` and available through the row's accessible/hover description.
Status words and status glyphs MUST NOT be rendered visibly in the row.
Author colors come from a deterministic cycle of existing tokens assigned per
slide with the lead always first. The badge's tooltip MUST use the canonical
short name as defined by `user-name-display`.
The item status tone map MUST be exhaustive over the validated
`ItemWorkflowStatus` contract (`planned | in_progress | paused | postponed |
done`) and MUST reuse the canonical status mapping for own and foreign rows.
An unvalidated or unknown item status MUST be rejected before rendering; no
neutral or PLANNED compatibility fallback is allowed. Current work, next focus,
and risks use their canonical tone/glyph mappings, while risk severity remains
in the row frame. A risk with `riskSeverity: "blocked"` MUST render with the
row highlight treatment and no visible status badge; blocker emphasis MUST NOT
appear outside the Risks column.

Each item row MAY intentionally clamp its body to two lines to keep the grid
compact, but its prose MUST act as a focusable disclosure that expands the full
text and supplied supporting details inline. Click, Enter and Space MUST toggle
the reading state; Escape MUST collapse it and retain focus on the prose.
Editable rows MUST keep double-click editing and MUST expose an explicit Edit
action after expansion. Reading activation MUST NOT emit an edit command.
Clamping MUST NOT remove a source row; all rows remain present in Document
density and all rows/pages remain present exactly once in Presentation density.

#### Scenario: consecutive same-author rows retain record attribution

- **WHEN** one cell holds three consecutive items by the same contributor
- **THEN** all three rows show that contributor's initials badge at top-right
- **AND** every row's text starts at the same left edge

#### Scenario: clamped text remains available

- **WHEN** an item text exceeds two lines in a slide row
- **THEN** the visible body is clamped to two lines
- **AND** click, Enter or Space on its prose persistently expands the complete text and status
- **AND** Escape collapses the disclosure with focus retained on the prose
- **AND** the source item is not dropped from the document or presentation pages

#### Scenario: blocked risk highlights

- **WHEN** a risk has severity `blocked`
- **THEN** its row gets the highlight treatment, shows no visible status badge, and
  keeps stage icons in the bottom-right metadata rail

### Requirement: Stage watermarks and cell ordering follow the canonical stage order

Item rows at product level MUST show their SDLC stages as persistent low-opacity
icons in the row's bottom-right metadata rail, one icon per stage, reusing
`STAGE_ICONS` from
`apps/web/src/features/report-sections/model/stage-chip-config.ts` with the
stage name in a `title` tooltip; rows inside project subsections render without
stage icons. Rows within a cell MUST sort by the item's first stage index in
`STAGE_NAMES` (`packages/shared/src/schemas/stages/stage-names.ts`), then by author with
the lead first; the sort MUST be stable.

#### Scenario: multi-stage item

- **WHEN** a product-level item carries the Development and Support stages
- **THEN** both stage icons render in the bottom-right metadata rail
- **AND** neither icon changes the item's left text alignment

#### Scenario: cell sorts by stage then author

- **WHEN** a cell holds a Support-stage item by the lead and a Planning-stage
  item by a contributor
- **THEN** the Planning item renders first

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
