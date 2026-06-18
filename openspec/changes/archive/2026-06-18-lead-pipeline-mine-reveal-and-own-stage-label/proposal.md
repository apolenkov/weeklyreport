# Clarify the completeness counter and reveal hidden Mine-mode stages on hover

## Why

Two live-demo observations on the lead SDLC pipeline card
(`apps/web/src/components/lead/sdlc-pipeline.tsx`):

1. The per-product "N/M stages" completeness counter does not read as the
   lead's OWN stages. `computeCompleteness` already counts only the lead's
   owned stages (`mine = stages.filter(ownership === "mine")`), so the number
   is honest — but the bare "stages" label invites the reader to think it
   covers the whole pipeline. A short "Your stages" label removes the
   ambiguity. This is a pure label change; the count is unchanged.

2. The shipped `lead-mine-hide-unowned-stages` change hides foreign-owned and
   vacant stages entirely in Mine mode. In the demo the lead wanted to still
   GLANCE at the hidden stages' status without leaving Mine. Hiding-entirely
   is slightly too blunt: it removes the chips and any trace they exist. A
   small indicator that some stages are collapsed, revealing the hidden
   stages' statuses on hover, lets the lead keep the focused Mine view AND
   peek at the rest — softening "hide entirely" toward "hide but reveal on
   demand", without un-hiding.

## What Changes

- **Affordance 1 (relabel):** the completeness counter pill labels the count
  as the lead's own stages (an English "Your stages" label near the counter).
  Count logic, health/left-edge derivation, and the dashed completeness ring
  are untouched.
- **Affordance 2 (reveal-on-hover):** in Mine mode, when the filter hides one
  or more of a product's stages, the card shows a small inert indicator that N
  stages are collapsed. Hovering the indicator reveals the hidden stages'
  names and statuses. The reveal is exposed non-visually too (so a non-visual
  user gets the same information), matching this capability's existing
  chip-`aria-label` accessibility bar. Mechanism (native `title` vs a tooltip
  primitive) is left to implementation, following the ComingSoon reference
  pattern in `apps/web/src/components/navigation/nav-bar.tsx`.

## Out of scope

- No change to `computeCompleteness` or to what counts toward completeness.
- No change to product health (left edge) or the dashed completeness ring.
- No change to Everyone mode — it already renders the full grid, so the
  indicator never appears there.
- The Mine filter still HIDES the chips; this adds a collapsed-stage summary,
  it does not un-hide or re-render the foreign/vacant chips inline.
- No new i18n; the label and indicator copy stay English.

## Impact

- Affected specs: `lead-pipeline-card`
  - MODIFIED: "The pipeline shows only the lead's own stages in Mine mode"
    (adds the reveal-on-hover indicator clause + scenarios).
  - ADDED: "The completeness counter labels the count as the lead's own
    stages".
- Affected code (implementation phase, not this change):
  - `apps/web/src/components/lead/sdlc-pipeline.tsx` — counter label (~line
    252-270) and the Mine-hide stage filter / collapsed-stage indicator
    (~line 200-321).
