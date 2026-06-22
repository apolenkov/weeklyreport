# Design

## Context

Verified by exploration:

- A product is a Prisma `Project` with one `leadId` owner; a lead's products are
  the `Project`s where `leadId` is that user. Assignment is the **Lead Owner**
  `<select>` in `admin/products-tab.tsx` → `trpc.admin.saveProject` →
  `project-admin.service.upsertProject`. No count guard anywhere.
- Records (items / decisions / risks) are added per product via the section
  components (`decisions-section.tsx`, `risks-section.tsx`, the items path in
  `lead-form.tsx`) and the `useEditableListDialog` flow. No per-section cap.
- The slides constant `MAX_VISIBLE_ITEMS = 3` lives only in the Product-scope
  `lead-product-grid.tsx`; the Summary path renders all rows.

## Decision 1 — advisory only, no enforcement

**Chosen:** both signals are non-blocking hints. Rationale:

- The lead asked to **show** the ceiling ("надо показать что максимум 6") and to
  **warn** ("скорее всего не поместится") — not to forbid.
- Hard caps risk data loss / friction, and the companion change makes slide
  overflow scroll-reachable, so nothing breaks if a lead exceeds the soft cap.
- MVP keeps schema disposable; adding a real per-lead enforced-cap column + Zod +
  server reject is heavier than the ask and would couple admin assignment to a
  number the lead called approximate.

Rejected: a hard cap that blocks `saveProject` / disables Save (over-engineered
for an advisory ask; reversible later if the lead wants true enforcement).

## Decision 2 — the numbers are tunable constants in shared

`MAX_PRODUCTS_PER_LEAD = 6` and `SLIDE_SECTION_SOFT_CAP = 5` exported from
`@customreport/shared`. The "6" is the lead's stated, approximate number — it is
recorded as a constant precisely so it is one obvious place to change, not buried
in a component. `SLIDE_SECTION_SOFT_CAP` is pinned to a concrete `5` (Codex F9 —
a vague "~5–6" is not testable) — chosen to align with what the
`fix-lead-slide-quadrant-overflow` baseline renders comfortably per quadrant
before scroll kicks in; both numbers are tunable and flagged for the lead. Keep
`MAX_VISIBLE_ITEMS` separate (it governs the Product-scope grid's truncation, a
different surface) — do not conflate.

## Decision 3 — where each signal lives

- **Product-per-lead:** a soft hint beside the admin Lead Owner select showing
  "N of 6 products" for the chosen lead. N MUST be computed from the FULL
  `products` prop filtered by the chosen `leadOwnerId` + active status — NOT from
  the component's `filteredProducts` (which the product filter + local search
  narrow, undercounting the lead's true product count during a search; Codex F8).
  Archived products are excluded, matching the tab's active/archived split. When
  N ≥ `MAX_PRODUCTS_PER_LEAD` the hint reads as a gentle recommendation; Save
  stays enabled.
- **Records-per-section (per product):** the sections (`CurrentWeekSection`,
  `NextWeekSection`, `RisksSection`, `DecisionsSection`) receive the whole
  cross-product list and group by product internally (`groupByProduct`), with one
  section-level Add control. So the advisory unit is per-(product × section),
  matching the slide's per-product quadrant — when a single product's count in a
  section exceeds `SLIDE_SECTION_SOFT_CAP`, a quiet advisory attaches to THAT
  product's group within the section (e.g. "This product has many items — may not
  fit cleanly on the slide."), NOT to the single section-level Add control.
  Non-blocking; disappears when back under the cap.

## Open taste calls (flagged for the lead, concrete defaults chosen)

- Soft cap values — `MAX_PRODUCTS_PER_LEAD = 6`, `SLIDE_SECTION_SOFT_CAP = 5`
  (concrete and tunable); adjust freely.
- Count scope — active products only, from the full product set (chosen); revisit
  if archived should count.
- Wording — English advisory copy; final phrasing is the lead's to tweak.

## Invariants / impact

- No DB / API contract change beyond two exported constants. No write-path
  change; `period-dual-state`, role-coverage gate, destructive guard untouched.
- SEQUENCING dependency on `fix-lead-slide-quadrant-overflow`: implement C2 AFTER
  the C1 overflow DIRECTION is locked. Under the scroll baseline the "won't fit
  cleanly" advisory is weak (it scrolls); under a continuation-slide / split
  choice it is outright WRONG (the content fits — on the next slide). So the
  section advisory's existence and exact copy must be revisited once C1's
  direction is decided. There is no build-time code dependency, but the
  advisory's semantics depend on C1 — do not ship C2's section warning blind.

## Test strategy

- Shared: a trivial assertion that the constants are exported and positive.
- Admin: render `products-tab` with a lead owning 6 active products → the
  over-cap hint shows; with fewer → it does not; Save is never disabled by it.
- Section: render a section with > `SLIDE_SECTION_SOFT_CAP` records → the advisory
  shows and adding is still allowed; under the cap → no advisory.
