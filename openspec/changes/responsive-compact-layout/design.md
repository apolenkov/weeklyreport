# Design — responsive-compact-layout

MVP, layout-only. Grilled + adversarially verified (2026-06-30). Locked: mixed viewport
floor; viewport-only compact reach; slides tablet+ (no phone slide idiom).

## Strategy

Desktop-down adaptation, not a mobile-first rewrite — the app is min-width-first
(`px-4 sm:px-6 lg:px-8`, fixed 16:10 slides, subgrid rails). Reuse Tailwind `sm/md/lg`;
`md` is the one compact↔full boundary. Compact-tier touch floor = existing
`--touch-target-min` (44px); desktop density stays `--toolbar-control-h` (32px).

## MVP slice

(1) the constraint + breakpoint/touch/density/no-overflow contract (the new capability);
(2) the C1 review surface born responsive (R6); (3) the visibly-breaking dense collisions
codified. Dialogs + lead form are codify-existing-behavior (light). Mobile nav deferred.

## Required MODIFIED follow-ups (author with the EXACT existing headers)

- `ui-control-density` — qualify the single-shared-height contract to within one viewport
  tier; compact tier = the touch floor.
- `head-slide-density` — KEEP the header "The inline head slide renders within a fixed
  slide frame"; the fixed-aspect frame applies at/above the slide floor (tablet). A
  retitle becomes REMOVED+ADDED — don't retitle.
- `lead-slide-quadrants` — same tablet floor for the lead "Own" slide.
- `head-dashboard-clarity` — count rails reflow to a wrapped labeled-value below `md`
  (it's a card list, not a table); the no-horizontal-scroll guarantee holds at every
  width.
- `record-dialog-layout` — codify the shipped `md:grid-cols-2`→1-col collapse,
  classification stacked beneath the primary fields.
- `toolbar-polish` — 32px icon buttons floor at `--touch-target-min` at the compact tier;
  keep `overflow-x-auto` on the report toolbar.

## C7 reflow note

The "head positional stability across Edit↔Slides" concern (C7) is whole-header
composition (slides renders its own header; the form delegates to `WeeklyReportPage`) —
broader than toolbar-semantics. Verify on a fresh build first; if it persists, home it
where header composition is governed, not here.

## Out of scope

Mobile-first rewrite; mobile nav/hamburger; persisted density toggle; phone slide-
presentation flow; new breakpoint/height tokens; palette/theme; toolbar "More"-menu;
responsive PDF/print; any C1 behavior change (layout only).
