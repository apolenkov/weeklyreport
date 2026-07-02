## Why

> Captured from 2026-06-30 demo feedback (cluster C5), grilled + adversarially
> verified. See `docs/feedback/decisions-locked-2026-06-30.md`.

"Make it more compact" and "think about mobile now — account for it in the layout." A
cross-cutting constraint on every surface (report, slides, lead form, dashboard) and
especially the new C1 review surface. The app is built min-width-first (fixed 16:10
slides, subgrid dashboard rails), so dense surfaces are desktop presentation artifacts.

## What Changes

- A **responsive acceptance constraint + breakpoint contract**: new interactive surfaces
  must have a defined compact (`<md`) layout; reuse the Tailwind `sm/md/lg` scale with
  `md` as the single compact↔full boundary (no bespoke tokens); compact-tier controls
  floor at the existing `--touch-target-min` (44px); a compact density baseline trims
  non-signal chrome at all tiers without dropping status signals.
- **Mixed viewport floor** (locked): dense surfaces (slides, dashboard) are tablet-floored
  (≥768); the lead form and the C1 review surface go to phone (≥360). With this floor,
  slides remain a tablet+ surface — **no phone slide idiom for MVP** (the report view is
  the phone experience).
- **The C1 review surface is born responsive**: per-record comments stack beneath their
  anchor record at every width — no side rail, no duplicated record content.
- Codify already-shipped collapses (record dialogs `md:grid-cols-2`→1-col; dashboard
  count rails reflow below `md`; report toolbar keeps `overflow-x-auto`).

## Capabilities

### New Capabilities

- `responsive-compact-layout`: the breakpoint/touch/density contract, the no-horizontal-
  overflow rule, and the responsive C1 review surface.

### Modified Capabilities

- (Implementation MODIFIED follow-ups captured in `design.md` with their exact existing
  headers: `ui-control-density`, `head-slide-density` (keep header "The inline head slide
  renders within a fixed slide frame"), `lead-slide-quadrants`, `head-dashboard-clarity`,
  `record-dialog-layout`, `toolbar-polish`.)

## Impact

- Web only — CSS/layout. No write path, no schema, no new procedure. No invariant
  engaged.
- Compact reach = viewport-only for MVP (desktop density unchanged beyond a light trim);
  no density toggle.
- Note: `head-slide-density` carries a recorded-sign-off + before/after-screenshots gate
  that any slide-layout change inherits.
- Out of scope: mobile-first rewrite; mobile nav/hamburger chrome; a persisted density
  toggle; phone support for the slide presentation flow; new breakpoint/height tokens;
  palette/theme change; toolbar "More"-menu; responsive PDF/print; any change to C1
  behavior (layout only).
