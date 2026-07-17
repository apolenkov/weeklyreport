## Context

The durable slide spec explicitly requires product status by color only. The chosen replacement must add a non-color channel without reintroducing the large chips the dense slide layout removed.

## Goals / Non-Goals

**Goals:** make on-track, at-risk, and blocked distinguishable by shape and accessible text while retaining the stripe.

**Non-Goals:** change aggregation, status colors, or card density materially.

## Decisions

Place a compact status mark beside the product name. Each state gets a distinct icon shape and an accessible English label: `On Track`, `At Risk`, or `Blocked`. The label may be visually compact/hidden when space requires, but it must be present in the accessible name; the icon is never the sole label. The existing stripe stays as reinforcement.

No-status products retain the collapsed dashed row and `no status for this period` copy, without a misleading icon.

Tests query the product heading/status by accessible name and also assert distinct icon identity, not CSS color values alone.

## Risks / Trade-offs

- Extra chrome may reduce title space → use the existing compact icon scale and keep the mark adjacent to the name.
- Icon meaning can drift → centralize the status-to-icon/label map and cover every union member.

## Invariants

Status derivation and tokens are preserved; this changes presentation semantics only.
