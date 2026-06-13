# Design — Lead Stripe Semantics and Archived Badges

## Context

Two user decisions from feedback round 3 (2026-06-10): stripe color
derives live from own stages; "[Archived]" text becomes a neutral
badge everywhere. DB evidence for the stripe bug: boris week-24
sections carry seeded `ProjectStatus` yellow for CRM-Sales Hub and
Платформа интеграций while every own chip is empty.

## Goals / Non-Goals

**Goals:** stripe and chips can never contradict; archived markers are
badges, not raw text; seed data is internally coherent.

**Non-Goals:** changing `trafficLight` persistence or any head/slide
consumer; new tokens; redesigning the toolbar layout.

## Decisions

### D1 — Stripe derives live from own stages, render-side only

In `SdlcPipeline`, compute per product:
`worstOwnStatus = worst(stages where ownership === 'mine')` using the
existing severity order (blocked > at-risk > on-track; empty
contributes nothing); all own stages empty → `empty` (neutral stripe).
Pass that to `getProductCardStyle` instead of `product.overallStatus`.
`overallStatus`/DB `trafficLight` remain untouched for head surfaces.
The dashed rule (any own stage unfilled → dashed) is unchanged.
Rationale: the lead's stripe shows what the lead's chips say — one
source of truth on one surface; after any interaction the DB aggregate
converges to the same value, so divergence dies with no API change.

### D2 — Neutral "Archived" badge, shared look in both places

A small muted pill (muted background token + muted-foreground text,
pill radius, same size class as the "Previous" badge) labelled
"Archived". Identity cue, NOT a status hue — per the recorded
status-hue lesson red/amber/green are forbidden here. Used in the
Fill From rows (right side, may coexist with "Previous") and in the
period dropdown options.

### D3 — PeriodNavigator: custom listbox replaces the native select

Native `<option>` cannot render markup, so the combo becomes a custom
dropdown: trigger button (same pill, same height — ui-control-density)
opening a portaled panel (mirror the proven fill-from portal: fixed
positioning from trigger rect, scroll/resize tracking, dual-ref
outside click). A11y contract: trigger `role="combobox"`
`aria-expanded` `aria-haspopup="listbox"`, panel `role="listbox"`,
options `role="option"` with `aria-selected`; ArrowUp/Down move,
Enter/Space select, Escape closes, focus returns to the trigger. The
component keeps its props API so lead-form and head-report-shell need
no changes. Keep the existing `aria-label` ("Select reporting period")
on the trigger so e2e/sweep selectors keep matching where possible —
recon must grep e2e for selectors that assume a native select and the
change must update them.

### D4 — Seed coherence rule

For every seeded section, `ProjectStatus.status` = aggregate of that
author's own seeded stage statuses for that product (worst-of; no own
statuses → omit the row or green, matching what the app itself would
write). This makes head dashboards/slides consistent with what leads'
chips show, and the lead stripe (now live) matches the seeded DB.

## Risks / Trade-offs

- [Custom select a11y regressions] native selects are free; the
  listbox must be keyboard-complete → explicit a11y checks in review +
  the axe sweep covers the page.
- [e2e/sweep breakage] tests may use `select`/option semantics →
  recon greps `e2e/` for period-selector usage; update in the same
  change. e2e is not tsc/eslint-gated; validate via
  `playwright test --list`.
- [Stripe meaning shift] the stripe no longer mirrors what the head
  currently sees (stale DB value) until the lead interacts — accepted
  by the user explicitly; the head keeps its own truth.
