# lead-slide-by-product-grid Specification

## Purpose

The status slide deck uses one by-product article for lead, head, and viewer
presentation surfaces. The article renders an auto-height canvas with a header,
priorities, responsive category labels, product cards, contributors, and stage legend. It
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

### Requirement: Header summarizes the owner's period

The header MUST show: a worst-status pill derived from all product, activity, and risk
signals on the slide, the owner's name, counters for current items, risks, and
priorities, and an "N of M products on track" chip. A slide with blocked or
at-risk signals MUST retain that severity in the summary even when it has no
current or next items. Deck-owned controls MAY render at the end of the header,
but mode/scope ownership stays outside the article. All colors MUST come from
existing design tokens.

#### Scenario: worst status wins the pill

- **WHEN** the slide has products on track and one blocked product
- **THEN** the header pill shows the blocked treatment

#### Scenario: an at-risk activity raises the pill

- **WHEN** every product is on track and one activity is at risk
- **THEN** the header pill shows the at-risk treatment

#### Scenario: all products on track

- **WHEN** every product with data is on track
- **THEN** the "N of M products on track" chip drops the alert tint

#### Scenario: a blocked risk is the only update

- **WHEN** a slide has a blocked risk and no current or next items
- **THEN** its summary tone is blocked
- **AND** review ordering places it before warning and ordinary empty slides

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

### Requirement: Priority strip shows all ranked items

The priority strip MUST render one card per item carrying a `priorityRank`,
across all products in the authorized section projection; risks and decisions MUST NOT enter the strip.
On a Lead deck, only the lead's own section items supply ranks, including in
Everyone mode: foreign rows MUST NOT expose private ranks or add priority cards.
Head Product scope MAY aggregate ranked items from its authorized source sections
while preserving each item's original author. Cards order by ascending rank;
ties retain source order. Ranks are personal, so two P1 cards from different
authors in Head Product scope are valid. Each card MUST
show the P-badge tinted with the author's color, the full item text wrapping
without truncation, the product name, and the author's initials badge.

#### Scenario: Head Product scope contains two P1s from different authors

- **WHEN** two authorized source sections each contribute a rank-1 item to the Product slide
- **THEN** both cards render with their original authors in stable source order

#### Scenario: Lead Everyone does not disclose foreign priorities

- **WHEN** a Lead switches to Everyone on a shared Product
- **THEN** foreign items may appear as ordinary rows without private rank metadata
- **AND** the priority strip and priority counter still use only the lead's own ranked items

#### Scenario: risks never enter the strip

- **WHEN** a slide has risks and zero ranked items
- **THEN** the priority strip renders nothing

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
slide with the lead always first; the full name lives in the badge's tooltip.
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

### Requirement: Legend names contributors with their roles

The slide footer MUST render a legend listing each contributor: initials badge in the contributor's assigned color, short name as defined by `user-name-display`, and the persisted `authorRole` suffix. Every current cross-author content row MUST carry a valid `DbRole`; missing roles are invalid input and MUST NOT be represented by a placeholder.

#### Scenario: contributor role is rendered

- **GIVEN** a contributor has persisted role `viewer`
- **WHEN** the contributor legend is rendered
- **THEN** the entry shows the badge, short name, and `viewer` role suffix

#### Scenario: visible legend uses canonical short names

- **GIVEN** a contributor's full name is Иванов Василий Петрович
- **WHEN** the contributor legend is rendered
- **THEN** its visible name label is Иванов В.П.
- **AND** its existing initials, assigned color and persisted role remain unchanged

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

The lead slide grid MUST show the record-author mark on every content row. In
the single-author Mine scope, priority cards and the contributor legend MUST NOT
repeat the selected deck author's initials because the slide header already
establishes their scope-level ownership. In Everyone or another multi-author
scope, priority cards and the legend MUST carry the same stable identity used by
the row marks.

#### Scenario: a lead views their own Mine slide

- **WHEN** the lead slide deck is scoped to Mine and every row belongs to the selected deck owner
- **THEN** every row renders the record author's initials at top-right
- **AND** priority cards render without the owner's repeated initials badge
- **AND** priority rank badges use a neutral rank background instead of an owner identity color
- **AND** an owner-only contributor legend is omitted instead of leaving an empty separator
- **AND** record status and stage marks keep their existing order and meaning

#### Scenario: a lead switches to Everyone

- **WHEN** the lead slide deck is scoped to Everyone
- **THEN** every row shows that record author's stable mark, including the selected owner
- **AND** priority cards and the contributor legend show their author marks
- **AND** priority rank badges retain their author identity color

#### Scenario: a multi-author slide is reviewed outside the lead Mine scope

- **WHEN** a head or viewer reviews content whose rows can belong to different authors
- **THEN** author marks remain visible and consistent with the contributor legend

### Requirement: Header counter labels match their counts

The slide header MUST preserve the numeric current-item, risk, and priority
counts. Risk and priority labels MUST use singular English at exactly one and
plural English at zero or more than one.

#### Scenario: risk and priority counts vary

- **WHEN** a risk or priority counter is zero, one, or greater than one
- **THEN** its number remains unchanged
- **AND** one reads `risk` or `priority`
- **AND** zero and greater counts read `risks` or `priorities`

### Requirement: Clamped slide rows provide persistent full-text disclosure

Every non-empty slide row MUST expose a persistent, focusable disclosure that
reveals the complete status-and-text content inline without depending on
rendered overflow measurement. Risk disclosure MUST also show supplied impact
and mitigation; Decision disclosure MUST show supplied impact. Missing
supporting values MUST be omitted rather than fabricated.
The control MUST expose its expanded state and controlled region to assistive
technology, support keyboard activation, collapse on Escape while retaining
focus, and MUST NOT invoke an edit or mutate report data. The existing compact
two-line default, pointer-hover description and editable-row activation remain.

#### Scenario: A keyboard user reads and closes a long row

- **GIVEN** a Risk, Decision, Current or Next row whose body exceeds two lines
- **WHEN** the user focuses and activates its full-text disclosure
- **THEN** the complete row text remains visibly expanded until explicitly collapsed
- **AND** Escape collapses it with focus still on the disclosure
- **AND** no edit or draft command is emitted

#### Scenario: Supporting prose is available

- **GIVEN** a Risk has impact and mitigation, or a Decision has impact
- **WHEN** the user expands its disclosure
- **THEN** each supplied value is shown with its field label
- **AND** blank values do not create placeholder details

### Requirement: Slide row metadata stays outside the prose flow

Every non-empty Current work, Next focus, Risks and Decisions row MUST render
its record prose from the same stable left edge. A compact right metadata rail
MUST keep only the record-author badge at its top-right and MUST keep only
applicable stage marks at its bottom-right. Metadata MUST NOT enter the prose
flow or change the left alignment of wrapped text. Stage marks MAY wrap within
the rail when needed. A row MUST NOT render a separate Read/Close label or a
visible status glyph.

Every row MUST show its persisted record-author badge, including consecutive
rows by the same author and owner rows in Mine scope. Missing author resolution
MUST retain the existing unknown-author mark and MUST NOT be replaced with the
last editor or another inferred identity.

The existing two-line collapsed body, status colors and hover details MUST
remain. The prose itself MUST be a focusable disclosure: click, Enter and Space
toggle persistent full-text details, while Escape collapses and retains focus
on the prose. These reading commands MUST NOT invoke editing. An editable row
MUST retain double-click editing and MUST show an explicit keyboard-reachable
Edit action inside its expanded content.

#### Scenario: Metadata does not indent row prose

- **GIVEN** rows in Current work, Next focus, Risks and Decisions carry author or stage marks
- **WHEN** the slide renders the rows
- **THEN** every prose body begins at the same left edge
- **AND** author and stage marks remain visible in the right metadata rail

#### Scenario: Repeated record author stays visible

- **GIVEN** consecutive rows belong to the same record author
- **WHEN** the cell renders those rows
- **THEN** every row shows that author's badge at top-right
- **AND** no neighboring row is required to identify the author

#### Scenario: Reading and editing remain separate

- **GIVEN** an editable row with clamped prose
- **WHEN** the user activates its prose with click, Enter or Space
- **THEN** the disclosure changes only its reading state
- **AND** no edit or report-data command is emitted
- **AND** the expanded content exposes a separate Edit action

### Requirement: Slide summaries cover every visible own record

The slide-level counters, readiness, and urgency MUST use the same own-record
scope as the by-product grid. Records parented to an Activity MUST contribute
exactly once just like Product-parented records, while retaining their existing
Activity subsection and Product-or-Shared home. Activity status and risks MUST
NOT change the derived health of a linked Product.

#### Scenario: Activity rows appear in the grid

- **WHEN** an Activity has current work, a risk, a decision, and a ranked item
- **THEN** every row appears in its existing Activity subsection
- **AND** the slide-level counters and readiness include every visible record
  exactly once

#### Scenario: Activity risk is blocked

- **WHEN** a blocked risk is parented to an Activity
- **THEN** the slide summary retains blocked urgency and risk readiness
- **AND** no linked Product's derived health changes because of the Activity risk
