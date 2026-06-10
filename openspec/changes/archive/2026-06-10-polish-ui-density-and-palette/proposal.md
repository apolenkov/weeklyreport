# Polish UI Density and Palette

## Why

A 2026-06-10 walk-through of the live app surfaced five visual-quality
regressions that accumulated from incremental edits. None are functional bugs —
every flow works — but the interface reads as inconsistent and, in places,
garish. The static gates and the behavioral driver cannot see any of this; it is
an aesthetic axis. Captured from real screenshots (see memory
`design-polish-backlog-2026-06-10`).

Two tiers, because the repo's "Visual And Theme Work" rule makes color/theme
changes research-only until a concrete direction is chosen:

- **Layout/density (implementable now):** spacing and height inconsistencies.
- **Palette (research-only):** color choices that need options + sign-off before
  any CSS lands.

## What Changes

Layout/density fixes (implement):

- **Select/combobox chevron** — the right-edge dropdown chevron sits flush
  against the border with too little padding. Give it breathing room so the
  affordance does not read as clipped.
- **Admin users-tab filter row** — `Active` / `All roles` / `All groups` /
  `Search users…` / `Add User` have inconsistent heights in one row. Align them
  to a single control height.
- **Status Report header (head view)** — the action buttons (`By product / By
lead`, `Edit`, `Slides`, `Agent review`, `Export PDF`, `Archive`, `Reopen
Period`) have different heights and unclear grouping. Normalize heights and
  give the cluster a clearer visual hierarchy.

Palette explorations (research memo + options only, NO CSS without sign-off):

- **Product Status stage chips** — the beige/cream background of the "assigned"
  product group reads as an unappealing color. Explore a calmer palette and
  optional per-phase icons for the SDLC stages.
- **Section preview card** (e.g. CRM-Sales Hub) — too many competing colors at
  once across `NEEDS ATTENTION` / `RISKS & BLOCKERS` / `TOP PRIORITIES` labels
  and tinted item rows ("parrot" effect). Propose a calmer, cohesive color
  hierarchy.

## Impact

- Affected surfaces: shared select/combobox component, admin users-tab filter
  row, head Status Report header, lead/head Product Status pane, section preview
  card.
- Risk: low. Layout fixes are spacing/height tokens on existing components;
  palette work ships zero code until a direction is approved.
- Verification: re-screenshot each surface before/after; the layout fixes must
  not regress keyboard reachability or the a11y behavior just verified in
  `a11y-regression-coverage`.

## Non-goals

- **Implementing any color/background/theme change.** The palette items (#4, #5)
  are research-only per the repo "Visual And Theme Work" rule; this change
  delivers options and a recommendation, not CSS tokens, until the user picks a
  direction.
- **A full rebrand or design-system overhaul.** Scope is the five observed
  surfaces, not a global restyle.
- **Driver visual-review automation.** The idea of adding a screenshot +
  frontend-design review stage to the driver run is recorded separately (memory
  `design-polish-backlog-2026-06-10`) and is a skill change, not this UI work.
