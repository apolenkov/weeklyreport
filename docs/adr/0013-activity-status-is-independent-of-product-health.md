# Activity status is independent of product health and portfolio rollups

**Status:** proposed (locked via the demo-feedback grill on 2026-06-30; not yet
implemented — tracked by `openspec/changes/project-activity-reporting`)

## Context

A Project Activity (ADR 0012) may carry an optional `projectId` link to a Product.
That link raises an immediate question: when a lead reports an activity `red`
(blocked), should the linked Product turn red too, and should the blocked activity
feed the portfolio overview totals and the escalation set?

Product health is **stage-driven** — it derives from the worst owned-stage status
and the risk-derived `crossAuthors` read, a load-bearing invariant the slides,
dashboard, and escalation surfaces all depend on. Blending a stage-less activity
signal into that derivation would make a product's traffic light depend on two
unrelated mechanisms and break the "health comes from stages" contract that the
rest of the system reads as ground truth.

## Decision

Activity status **does not roll up**. In v1:

- A blocked activity does **not** drive its linked Product red — the Product's
  health stays derived from its owned stages and risks alone.
- Activity status does **not** contribute to portfolio-overview totals.
- A blocked activity does **not** enter the escalation / `at_risk` set.

Activities are shown beside the Product with their own independent status (the
`projectId` link is label-only — it groups the activity visually, it does not
entangle health). The head and viewer see activities and their status; the
published snapshot includes them.

## Consequences

- The stage-driven product-health invariant is preserved exactly; no surface that
  reads product health needs to change.
- The activity signal is **additive, not blended** — a reader sees the activity's
  own traffic light without it silently re-coloring a product or inflating
  portfolio counts.
- If a future product decision wants worst-of rollup (activity influences product
  health) or activities in escalations, that is an explicit new decision with its
  own ADR — it is recorded here as deliberately excluded so a later reader does
  not assume worst-of was an oversight.
- Activities are not searchable in v1 (they do not enter the published-search
  index), consistent with their non-rollup, beside-the-product placement.
