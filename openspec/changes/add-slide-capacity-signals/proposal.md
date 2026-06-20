# Add advisory capacity signals for products and slide sections

## Why

Nothing tells a lead or admin when a person/section is overloaded for the slide
view (live feedback, 2026-06-20). The lead wants two non-blocking signals:

1. **Products per lead** — "максимум 6 продуктов на человека": when assigning a
   product owner in admin, show the lead's current product count and a
   recommended ceiling, so nobody is silently overloaded.
2. **Records per slide section** — "если накинешь 10 items вместо 3, не
   поместится": when a lead adds many items / decisions / risks to a product,
   warn that the section likely will not present cleanly on the slide.

Today neither exists: no per-lead product ceiling and no per-section record
ceiling live anywhere in the schema, Zod, tRPC, or the UI (verified) — neither
advisory nor enforced. Slides degrade
gracefully (the companion change `fix-lead-slide-quadrant-overflow` makes
overflow scroll-reachable), so these are **advisory** signals, not hard gates.

## What Changes

Add two advisory, non-blocking UI signals driven by named constants in
`@customreport/shared`:

- `MAX_PRODUCTS_PER_LEAD` (= 6) — surfaced in the admin product-assignment UI
  (near the Lead Owner select) as a soft hint plus the lead's current count;
  exceeding it shows a recommendation, never blocks the save.
- `SLIDE_SECTION_SOFT_CAP` (= 5) — when a single product's record count in a
  section (current / next / risks / decisions) exceeds it, the lead sees a quiet
  "this may not fit cleanly on the slide" advisory attached to that product's
  group within the section; it never blocks adding.

All new copy is English (UI-strings rule). The "6" is the lead's stated number,
recorded as a tunable constant (soft cap) — not a hard enforced rule.

## Non-goals

- **No enforcement.** No Prisma column, no Zod `.max()`, no tRPC reject, no
  disabled Save. Advisory only (the lead said "показать" / "скорее всего не
  поместится", and the MVP keeps data disposable).
- No real layout measurement — the signal is a count heuristic against a
  constant, not a pixel-fit check.
- No change to the Product-scope grid's "+N more" or to slide rendering (that is
  `fix-lead-slide-quadrant-overflow`).
- No DB / API / shared-schema-contract change beyond the two exported constants.

## Sequencing

Implement AFTER the `fix-lead-slide-quadrant-overflow` direction is locked. The
section "may not fit the slide" advisory's wording depends on it — under the
scroll baseline it is weak, and under a continuation-slide / split choice it is
wrong (the content fits on the next slide). The product-count advisory is
independent and can land any time. See that change's `design.md`.

## Capabilities

- `slide-capacity-signals` — ADDED: advisory product-per-lead and
  record-per-section capacity hints, non-blocking.
