# Design — Pipeline State vs. Completeness

Design questions from `proposal.md` resolved with the user on 2026-06-13/14.

## D1. "My part complete" rule (proposal Q1)

**Decision:** a product's own-input is **complete** when **every stage the lead
owns for that product has an explicit status set** (on-track / at-risk /
blocked). A stage with no status chosen is "not done".

- Simple and checkable; does not depend on free-text fields (impact/mitigation
  text is not required for completeness).
- Completeness applies **per product** (the card-level signal), computed from
  that product's owned stages (proposal Q4: per-product, derived from stages).
- Rejected: "all required fields across my sections" — too broad, blurs the
  pipeline-card meaning (user steer: keep layouts clear, not sprawling).

## D2. Completeness affordance (proposal Q2)

**Decision:** a **distinct non-color affordance** on the right of the card:

1. A **dashed/dotted outline** ring while own-input is **incomplete**; the ring
   is removed (solid/none) when complete — so "unfinished" reads as a sketch.
2. A small **counter pill** `N/M stages` (filled owned stages / total owned
   stages) next to the ring for the exact state.

- Must NOT reuse the health hue. Health is the left edge; completeness is the
  right affordance. The two never share a cue (spec requirement).
- Counter uses named constants for the dash geometry; no magic numbers.

## D3. Relationship to `unify-risk-stage-status` (proposal Q3)

**Decision:** the left-edge **severity source stays the risk model** from the
archived `unify-risk-stage-status`. This change is **presentation +
derivation** on top of it, not a new risk model:

- Risks are still authored only in the Risks section (unchanged).
- Stage/product status is a **pure derivation** of covering risks (tasks 1.4–1.6):
  adding a risk reflects up immediately; blocker > at-risk > on-track; the
  "unbacked stage" warning is removed because status can no longer be set
  without a backing risk.
- The completeness signal (D1/D2) is **orthogonal** to severity — it measures
  whether the owner chose a status for each stage, not whether the product is
  healthy.

## Open implementation note

- Verify the existing risk-coverage predicate (the one
  `unify-risk-stage-status` introduced) is reused for both the left-edge
  severity and to know which stages are "covered" — do not invent a parallel
  predicate (CLAUDE.md: don't reinvent the wheel).
