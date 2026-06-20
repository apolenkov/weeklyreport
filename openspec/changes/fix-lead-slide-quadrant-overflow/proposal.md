# Fix dense lead slide quadrants clipping their rows

## Why

On the lead "Own" / Summary slide, dense quadrant content is silently cut off
(live feedback + screenshot, 2026-06-20: "уже не помещается"). Each
`QuadrantCard` in `lead-unified-slide.tsx` has `overflow-hidden` and only a
`min-h` floor — no `max-height`, no scroll. The 2×2 grid uses `auto-rows-fr`
(two equal rows), so the dense top row (Current / Next) is clipped at a fixed Y
while the sparse bottom row (Risks / Decisions) sits half-empty. Rows below the
cut are **unreachable** — data loss, not just ugliness.

This already contradicts the durable specs: `status-slide-rendering` and
`head-slide-density` require overflow to "stay reachable via scroll inside the
card" with a finite `max-height`, and `lead-slide-quadrants` requires "every row
renders — no count-based truncation". The implementation honours none of these
for the unified quadrant card.

## What Changes

Make each quadrant's overflow **reachable**, the minimal fix that stops data
loss without reversing any signed-off design decision: give the quadrant card
`overflow-y:auto` + `min-h-0` (replacing `overflow-hidden`) so it scrolls WITHIN
its grid row instead of clipping, and carry the per-quadrant floor on the grid
TRACK (`grid-auto-rows: minmax(var(--slide-quadrant-min), 1fr)`) rather than on
the card — so the equal-zone distribution and the sparse-case floor are preserved
without colliding with the card's `min-h-0`. No literal `max-height` is set; the
row track supplies the height. The no-"+N more" rule and the fullscreen behaviour
are preserved.

## Explicit limit of this change (needs a user decision to go further)

This stops the clip; it does **not** deliver what the lead actually asked —
content that **fits on one screen** or **splits across two slides**. Both of
those reverse the user-signed-off 2026-06-10 quadrant design (concept B: strict,
visually-equal quadrants in a fixed-aspect single slide). That is the lead's call,
not an autonomous one. `design.md` lays out three directions — (1) scroll
(this baseline), (2) a taller / multi-page slide frame, (3) continuation slides
("2/3") — with trade-offs, for sign-off. Only the baseline is encoded in the spec
delta here.

Cross-change note: the sibling `add-slide-capacity-signals` hangs a "may not fit
the slide" authoring advisory off this overflow behaviour. Under the scroll
baseline that advisory is weak; choosing direction 2 or 3 makes it WRONG (the
content fits — on the next slide), so picking 2/3 forces revisiting that change's
section advisory copy.

## Non-goals

- No continuation-slide pagination and no content-aware unequal distribution —
  both reverse the equal-zone sign-off; deferred to the user decision above.
- No auto-scale / shrink-to-fit (bakes in inconsistent type sizes).
- No change to the Product-scope grid's existing "+N more" (a different surface).
- PDF export is unaffected — it renders from the separate `/print/[reportId]`
  template, not this slide, so on-screen scroll introduces no PDF regression.
- No DB / API / shared-schema change.

## Capabilities

- `lead-slide-quadrants` — MODIFIED: a quadrant that overflows its zone is
  scroll-reachable, not clipped.
