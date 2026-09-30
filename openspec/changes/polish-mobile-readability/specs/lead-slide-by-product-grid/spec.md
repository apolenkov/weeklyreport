## MODIFIED Requirements

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
