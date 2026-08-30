# Design

## Information architecture

```text
Product Status  compact summary; actionable exceptions first
Work            Planned/In progress | Completed | Next
Attention       Risks | Decisions
Submit          readiness and completion actions
```

The temporal labels are presentation groups over existing item fields. Before
implementation, the mapping for paused, postponed, and carried-over items must
be reconciled with the canonical activity buckets; no item may be silently
reclassified or written back from a display-only group.

## Responsive contract

- Below 48 rem: one vertical flow, direct 44 px add/disclosure controls, no
  nested horizontal gesture, and no carousel.
- From 48 rem: the same DOM order may use denser rows or columns when every
  label and action remains reachable without page overflow.
- Product Status stays compact when healthy. Missing, at-risk, and blocked
  stages expose counts and direct targets before healthy detail.

## Reuse boundaries

- Extend the existing unified activity projection rather than inventing a new
  persisted collection.
- Keep `DraftPatch`, autosave, item/risk/decision dialogs, and the sync bridge
  as the only write boundaries.
- Derive achievements from completed current-week items.
- Compose Risks and Decisions under one visual wrapper only after extracting
  body primitives; do not nest interactive accordions.

## Activation gate

Activation starts only after the current product-first closeout is complete
and a focused OpenSpec change ratifies the temporal-bucket mapping. Acceptance
requires desktop, tablet, and 375 px browser evidence; keyboard and touch
access; no unexpected console/network errors; and focused callback-routing,
autosave, foreign-row, snapshot, and read-only tests.
