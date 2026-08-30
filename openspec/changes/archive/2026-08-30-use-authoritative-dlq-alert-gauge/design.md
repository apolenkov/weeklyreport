## Context

See `proposal.md`. The API already exports an absolute DLQ gauge from `getFailedCount()`, while the Prometheus rule still reads the event counter.

## Goals / Non-Goals

**Goals:**

- Align the active alert with the restart-safe metric.
- Ratchet the rule through a repository test.

**Non-Goals:**

- Change metric collection, queue behavior, dashboards, or alert duration.

## Decisions

- Change only the alert expression to `cr_dlq_failed_current > 0`. Rebuilding state from the counter was rejected because it cannot recover failures missed before process start.
- Parse the named YAML rule as a bounded text block in the existing operations gate. A new YAML dependency is unnecessary for one stable invariant.
- Preserve period dual-state, role coverage, destructive-database guards, and deferred-feature conventions unchanged.

## Risks / Trade-offs

- [Gauge appears only after the first poll] → retain the existing five-minute alert hold; no false immediacy is claimed.
- [Text-based gate could match another rule] → scope assertions to the `DLQFailuresActive` block.

## Migration Plan

Deploy the rule with the existing API metric. Roll back by reverting the rule; no data or schema migration is involved.
