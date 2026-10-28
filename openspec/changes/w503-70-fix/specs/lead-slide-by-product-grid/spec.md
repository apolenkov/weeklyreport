# lead-slide-by-product-grid Specification Delta

## MODIFIED Requirements

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
render an em dash placeholder with `role="img"` and an accessible empty-cell announcement label.

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

#### Scenario: empty cell placeholder exposes role and accessible name

- **WHEN** a slide cell has no rows
- **THEN** its placeholder element exposes `role="img"` and `aria-label="No <label>"` to assistive technology
- **AND** internal presentation elements remain `aria-hidden="true"`
