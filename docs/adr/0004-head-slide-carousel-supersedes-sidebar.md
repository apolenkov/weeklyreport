# 4. Head slide deck adopts the lead carousel/fullscreen model

Date: 2026-06-22

## Status

Accepted (supersedes the `head-slide-density` "stay distinct" requirement).

## Context

`head-slide-density` was accepted on 2026-06-10 after four feedback rounds. It
deliberately kept the head status deck distinct from the lead deck: a left
multi-lead sidebar for navigation and a separate right SLIDE COMPLETION /
readiness aside, explicitly forbidding folding those head-only surfaces into the
slide.

In the live demo on 2026-06-22 the user found that surface confusing: the slide
status was shown twice (sidebar card badge + slide header), the `Agent review`
placeholder floated and overlapped the completion panel, and the deck did not
present like the lead deck. The user directed a full rework so the head deck
uses the same navigation model as the lead deck.

## Decision

The head status deck adopts the lead deck's navigation model:

- A top horizontal carousel replaces the left sidebar list.
- The active slide fills the viewport (lead fullscreen idiom).
- The readiness / completion signal folds into the active slide as a compact
  strip; the separate right panel is removed.
- The slide status renders exactly once.
- The inert `Agent review` placeholder gets a fixed slide-header slot.

"Same as the lead deck" means the same NAVIGATION model, not the same data
scope: the head still sees every lead's data; the lead still sees only their own.

The framed-card section grid, neutral headers with token-driven stripes, and the
token-only color rule from `head-slide-density` are retained.

## Consequences

- The `head-slide-density` requirement "Head-specific surfaces stay distinct
  from the lead idiom" is removed (see change `head-slides-carousel-fullscreen`).
- The two decks converge on one navigation component, reducing divergence and
  the maintenance of two fullscreen idioms.
- Reversible only at the cost of re-litigating the four-round 2026-06-10 design;
  this ADR records why the earlier decision was overridden so a future reader
  does not treat the change as accidental drift.
