# Pipeline tooltip honesty + indicator coloring

## Why

Three problems on the SDLC pipeline's `+N more` collapsed-stages indicator, raised
in a live demo:

1. **The tooltip lies.** It lists every hidden stage as `name: empty`, including a
   stage that is OWNED by another author. The lead said: expanded, DevOps is taken;
   in the tooltip, DevOps reads "empty". The `status` field is `empty` because the
   current lead set no status, but the stage is NOT vacant — "no status yet" is
   conflated with "no owner".
2. **The tooltip is cramped and home-grown.** It is a single dark comma-joined line
   rendered by a custom `useSdlcTooltip`, while a ready Radix `Tooltip` already
   exists in `packages/ui` (`radix-ui` is already a dependency). The lead asked for a
   readable, multi-line redesign and to prefer a ready component.
3. **The indicator color is too quiet.** Per the prior `lead-demo-feedback` #90
   decision it colors ONLY when the worst hidden stage is blocked/at-risk and stays
   neutral grey otherwise. The lead now wants the full range: green when every
   hidden stage is on-track, grey when something is unfilled, severity colors above
   — so the product's left health stripe is traceable to the collapsed stages.

## What Changes

### 1. Honest reveal — CONFIRMED

The `+N more` reveal MUST distinguish an owned-but-not-yet-statused stage from a
vacant (unassigned) one. An owned hidden stage reads as its owner plus "no status
set"; a vacant stage reads as "unassigned". "empty" is never shown for a stage that
has an owner.

### 2. Radix tooltip everywhere in the pipeline — CONFIRMED (direction chosen)

The pipeline MUST render its tooltips through the shared Radix `Tooltip` from
`packages/ui` — for BOTH the stage chips and the `+N more` indicator — replacing the
custom `useSdlcTooltip`. The content is multi-line (one hidden stage per line), not a
single comma-joined string. One tooltip system, no new dependency.

### 3. Full-scale indicator color — CONFIRMED (reverses #90)

The `+N more` indicator border/text color MUST follow the full status scale by
precedence: red if any hidden stage is blocked, else yellow if any is at-risk, else
grey if any is unfilled (empty/unassigned), else green when every hidden stage is
on-track. This reverses #90's "neutral unless blocked/at-risk". It still MUST NOT
change product health (left stripe) or the own-input completeness counter.

## Out of scope

- The item-row stage chip stays an identity label (no status hue) per `CONTEXT.md`;
  this change touches only the SDLC pipeline chips and indicator.
- Reconciling the dark tooltip vs amber `ComingSoonBadge` languages app-wide.
- Removing `useSdlcTooltip` outside the pipeline if other surfaces still use it
  (audit handled by the separate reinvented-wheel change).
