# Fix Lead Stripe Semantics and Archived Badges

## Why

Live user feedback (2026-06-10, feedback round 3 on the lead surface,
right after `fix-lead-surface-snapshot-and-fillfrom` shipped):

1. The product-card left stripe shows a color with no visible
   correlate — fresh-week cards render an amber ("cappuccino") stripe
   while not a single chip is amber. Root cause verified in DB: the
   stripe reads the persisted `ProjectStatus.status` (the lead's LAST
   recorded health call, or an arbitrary seeded value) while chips show
   THIS week's stage statuses; the value recomputes only on chip
   interaction. User decision: the stripe must derive LIVE from the
   lead's own stages («Живой из своих стейджей»).
2. The literal "[Archived]" text prefix (shipped this evening) reads
   harsh («жестко выглядит») — replace it EVERYWHERE with a neutral
   badge, like the "Previous" pill: in the Fill From list and in the
   period selector.

## What Changes

1. `sdlc-pipeline.tsx`: stripe color = worst of the lead's OWN stages,
   computed live in the render (all own stages empty → neutral); the
   dashed-while-unfilled rule is unchanged. The DB `trafficLight`
   field, head dashboard, and slides are NOT touched.
2. `prisma/seed-simple.ts`: seed coherence — each section's
   `ProjectStatus` value must equal the aggregate of that lead's own
   seeded stage statuses (no more yellow products with zero yellow
   stages); head surfaces get realistic data.
3. `fill-from-button.tsx`: replace the "[Archived] " text prefix with
   a neutral muted "Archived" pill (identity cue, NOT a status hue —
   recorded lesson).
4. `period-navigator.tsx`: replace the native `<select>` (which cannot
   render badges inside options) with a custom dropdown using the
   established portal pattern: same props API, same control height
   (ui-control-density), keyboard accessible (arrows/Enter/Escape),
   "Archived" badge on archived options. Used by BOTH lead-form and
   head-report-shell — verify both.

**Non-goals:** no change to what the head/slides read (`trafficLight`
stays authoritative there); no new color tokens; no Fill From redesign.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `lead-report-controls-integrity`: the stripe requirement changes —
  color derives live from own stages instead of the persisted traffic
  light; the archived-marker requirement is restated as a neutral
  badge (not literal text) and the period selector becomes a custom
  listbox able to carry it.

## Impact

- `apps/web/src/components/lead/sdlc-pipeline.tsx` (+ its test).
- `apps/web/src/components/lead/fill-from-button.tsx` (+ test).
- `apps/web/src/components/lead/period-navigator.tsx` (+ test) — also
  consumed by `head-report-shell.tsx`; check e2e/sweep selectors that
  target the period combobox.
- `prisma/seed-simple.ts` + dev DB reseed.
- Spec: `openspec/specs/lead-report-controls-integrity/spec.md`.
