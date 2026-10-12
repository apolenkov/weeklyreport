## Purpose

Slide capacity signals are non-blocking advisories for places where CustomReport
can warn an admin before creating overloaded ownership. Slide presentation
capacity is not handled here: by-product slides are auto-height and governed by
`lead-slide-by-product-grid`.

## Requirements

### Requirement: Admin product assignment surfaces an advisory per-lead product count

The admin product-assignment UI MUST surface a non-blocking advisory of how many products a lead already owns relative to the recommended ceiling `MAX_PRODUCTS_PER_LEAD` (exported from `@weeklyreport/shared`, value 6), so an admin can see when a lead is being overloaded. The advisory MUST NOT block or disable saving: exceeding the ceiling shows a recommendation only. The count MUST consider active products only (archived products are excluded, matching the admin tab's active/archived split), and MUST be computed from the complete product set for that lead — independent of any UI filter or local-search state — so a search does not undercount the lead's true product count. `MAX_PRODUCTS_PER_LEAD` is a tunable recommendation (soft cap), NOT a hard enforced rule — no Prisma column, Zod `.max()`, or tRPC rejection enforces it.

#### Scenario: assigning a product to an already-full lead

- **WHEN** an admin selects a Lead Owner who already owns `MAX_PRODUCTS_PER_LEAD` active products
- **THEN** a non-blocking advisory shows the lead's current count against the recommended ceiling
- **AND** the Save action stays enabled and the assignment can still be saved

#### Scenario: assigning to a lead under the ceiling

- **WHEN** an admin selects a Lead Owner who owns fewer than `MAX_PRODUCTS_PER_LEAD` active products
- **THEN** no over-capacity advisory is shown (a plain count hint MAY still be shown)
- **AND** saving proceeds normally
