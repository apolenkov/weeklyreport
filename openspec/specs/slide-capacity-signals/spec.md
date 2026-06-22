# slide-capacity-signals Specification

## Purpose

TBD - created by archiving change add-slide-capacity-signals. Update Purpose after archive.

## Requirements

### Requirement: Admin product assignment surfaces an advisory per-lead product count

The admin product-assignment UI MUST surface a non-blocking advisory of how many products a lead already owns relative to the recommended ceiling `MAX_PRODUCTS_PER_LEAD` (exported from `@customreport/shared`, value 6), so an admin can see when a lead is being overloaded. The advisory MUST NOT block or disable saving: exceeding the ceiling shows a recommendation only. The count MUST consider active products only (archived products are excluded, matching the admin tab's active/archived split), and MUST be computed from the complete product set for that lead — independent of any UI filter or local-search state — so a search does not undercount the lead's true product count. `MAX_PRODUCTS_PER_LEAD` is a tunable recommendation (soft cap), NOT a hard enforced rule — no Prisma column, Zod `.max()`, or tRPC rejection enforces it.

#### Scenario: assigning a product to an already-full lead

- **WHEN** an admin selects a Lead Owner who already owns `MAX_PRODUCTS_PER_LEAD` active products
- **THEN** a non-blocking advisory shows the lead's current count against the recommended ceiling
- **AND** the Save action stays enabled and the assignment can still be saved

#### Scenario: assigning to a lead under the ceiling

- **WHEN** an admin selects a Lead Owner who owns fewer than `MAX_PRODUCTS_PER_LEAD` active products
- **THEN** no over-capacity advisory is shown (a plain count hint MAY still be shown)
- **AND** saving proceeds normally

### Requirement: Record sections surface an advisory when a section may not fit the slide

A lead-facing record section (current / next / risks / decisions) MUST show a non-blocking advisory when any single product's record count WITHIN that section exceeds `SLIDE_SECTION_SOFT_CAP` (exported from `@customreport/shared`, value 5), warning that that product may not present cleanly on the slide. The count unit is per-(product × section), matching the slide's per-product quadrant — NOT the section total — because the sections render the whole cross-product list and group by product internally; the advisory therefore attaches to the affected product GROUP within the section, not to the single section-level Add control. The advisory MUST NOT block adding records — the lead can always add more, and the slide is intended to degrade gracefully; the exact advisory wording is pending the `fix-lead-slide-quadrant-overflow` overflow DIRECTION (weak under scroll, wrong under split/continuation). `SLIDE_SECTION_SOFT_CAP` is a tunable heuristic count, NOT a measured pixel-fit and NOT the Product-scope grid's `MAX_VISIBLE_ITEMS`.

#### Scenario: a product exceeds the soft cap within a section

- **WHEN** a lead has more than `SLIDE_SECTION_SOFT_CAP` records for ONE product in one section
- **THEN** a quiet advisory attached to that product's group within the section warns it may not fit cleanly on the slide
- **AND** the lead can still add further records (the advisory never blocks the action)

#### Scenario: every product under the soft cap

- **WHEN** no product exceeds `SLIDE_SECTION_SOFT_CAP` records in a section
- **THEN** no slide-fit advisory is shown for that section
