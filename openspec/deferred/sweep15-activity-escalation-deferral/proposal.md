# Activity escalation remains deferred

> **DEFERRED 2026-07-15 — decision trace only.** This entry records a reviewed product decision. It contains no implementation tasks and no spec delta. Activation requires a new active OpenSpec change with fresh product decisions.

## Why

Activity-parented blocked items and unresolved risks are intentionally absent from the product-scoped escalation feed. The Product forks section of `docs/reviews/2026-07-15-external-sweep.md` raised parity for review; the 2026-07-15 council decision was to keep it deferred rather than imply an underspecified dashboard workflow.

## Decision

Keep the current [`status-risk-unification`](../../../specs/status-risk-unification/spec.md) contract unchanged: activity-parented records do not emit per-item, per-risk, or product-level escalations. This asymmetry is intentional; it is a deliberate deferral, not a correctness bug and not implementation authorization. The docs-only [`sweep15-spec-product-map`](../../sweep15-spec-product-map/proposal.md) change owns this discoverability update.

Before activation, product design must decide:

- **Prioritization:** how activity escalations rank against product blockers and unresolved risks in the head action queue.
- **Deduplication:** whether several records under one activity collapse into one activity signal, remain per-record, or share a two-level grouping.
- **Routing:** which report/dashboard surface owns the drilldown and what focused activity destination the row opens.
- **Notification:** who is notified, through which channel, at what cadence, and how repeated alerts are suppressed or acknowledged.

## Activation trigger

Create a new active change only after prioritization, deduplication, routing, and notification semantics are decided together. That change must modify the exact activity-deferral requirement in `openspec/specs/status-risk-unification/spec.md` and include its own implementation tasks and verification gates.

## Impact

None. No source, schema, API, UI, task, or durable specification changes are authorized by this trace.
