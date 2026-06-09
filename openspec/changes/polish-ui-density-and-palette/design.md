# Design

Two tiers, kept strictly separate so palette work never leaks into an
implementable task: **layout/density** ships code, **palette** ships a research
memo + options only (repo "Visual And Theme Work" rule).

## Tier 1 — Layout / density (implementable)

### #1 Select/combobox chevron spacing

- Target: `packages/ui/src/components/ui/select.tsx` (the shared trigger that
  renders the right-edge chevron). Confirm whether the admin filter selects and
  the lead "Product" select both route through this component or a variant
  (`apps/web/src/components/admin/admin-tabs-mobile-select.tsx`,
  `apps/web/src/components/lead/stage-multi-select.tsx`).
- Problem: the chevron is pinned to the right border with too little inline
  padding, so it reads as clipped.
- Approach: increase the trigger's right padding / chevron inset so there is a
  consistent gap between glyph and border. Keep the touch-target size. No color
  change.

### #2 Admin users-tab filter row height alignment

- Target: `apps/web/src/components/admin/users-tab.tsx` — the row holding the
  status filter (`Active`), role filter (`All roles`), group filter
  (`All groups`), `Search users…` input, and the `Add User` button.
- Problem: the five controls render at different heights in one row.
- Approach: unify them on one control height (reuse the design-system control
  height token rather than per-control heights). Verify the `Add User` button,
  which is the tallest, sets the baseline or is brought in line.

### #3 Status Report header button cluster

- Target: `apps/web/src/components/head/head-report-shell.tsx` — the
  `flex flex-wrap items-center justify-end gap-2` action cluster (~line 111+):
  the `By product / By lead` segmented toggle, `Edit`, `Slides`, `Agent review`,
  the icon-only Presentation/`Export PDF`, `Archive`, `Reopen Period`.
- Problem: mixed button heights and an unclear grouping/hierarchy — primary,
  secondary, and destructive-ish actions sit at one visual weight and varied
  sizes.
- Approach: normalize heights to a single control height; group by intent
  (view-mode toggle | primary edit/slides | utility export/archive/reopen) with
  spacing or dividers; keep one clear primary. No color/theme change — weight and
  spacing only. Re-check keyboard order is unchanged (a11y just verified).

## Tier 2 — Palette (RESEARCH-ONLY — no CSS without sign-off)

Deliverable for both is a short research memo with 2-3 concrete options
(screenshots/mockups), a recommendation, and the exact tokens that WOULD change
— but no edit to CSS/tokens/background until the user picks a direction.

### #4 Product Status stage chips + per-phase icons

- Target: `apps/web/src/components/lead/stage-chip.tsx` and the "assigned"
  product-group wrapper that paints the beige/cream background
  (`var(--color-surface-empty)` is a candidate token — confirm during research).
- Explore: a calmer group-background palette; optional per-phase SDLC icons
  (Planning/Analysis/Design/Dev/Testing/DevOps/Support) to replace or augment the
  plain status dot. Research current status-pipeline UI patterns first.

### #5 Section preview card color hierarchy ("parrot")

- Target: `apps/web/src/components/weekly-report/product-accordion.tsx` — the
  `NEEDS ATTENTION` / `RISKS & BLOCKERS` / `TOP PRIORITIES` section labels and the
  tinted item rows.
- Problem: too many saturated, competing accent colors at once.
- Explore: a restrained hierarchy — one accent for true alerts, neutral/muted for
  the rest — and reduced row-background tinting. Options + recommendation only.

## Verification

- Tier 1: before/after screenshots of each surface at the same viewport; confirm
  no keyboard-reachability regression (the controls stay focusable/operable per
  `a11y-regression-coverage`); `pnpm typecheck && pnpm lint && pnpm test`.
- Tier 2: memo reviewed and a direction chosen BEFORE any follow-up implements
  CSS.
