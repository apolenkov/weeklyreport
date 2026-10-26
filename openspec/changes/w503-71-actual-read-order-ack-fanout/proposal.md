# Proposal

## Why

C4915: the product accordion reads Current Week in priority-rank order but
Next Week in source order. The item editor offers a priority rank for Next Week
items too, and the accordion shows the rank mark, so a Next Week list can read
rank 2 above rank 1.

## What Changes

- The accordion reads Next Week items in ascending rank, unranked after ranked,
  ties and unranked in source order — the order Current Week already uses, via
  the same shared helper.
- Current Week order is unchanged.

## Decision

Decided 2026-10-15: Next Week reads in the same order as Current Week, through
the same shared helper. The display order is not a per-week difference.

## C5119 — no RED, measurement recorded

`ReviewAcknowledgeBar` invalidates `review.acknowledgements` with a path filter
that carries no report or group. Measured in jsdom
(`~/work/handoffs/task-503/wave14-71/D/measure-c5119.log`): with
three groups of one report mounted, one acknowledgement in group A refetches the
rosters of A, B and C (3 logical queries, 1 each after the initial load).
Rejected subclaim stays rejected: inactive caches are marked stale, not
refetched. Not shown: real HTTP cost (the transport is `httpBatchLink`, so
same-tick refetches are expected to share a request), group counts per report,
or a freshness requirement for sibling rosters. A narrower filter is a
cache-policy choice, so no failing contract is stated; the current sibling
invalidation is retained.

| Clause | Disposition                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------- |
| C4915  | Fixed: Next Week reads in rank order, same as Current Week.                                    |
| C5119  | No RED: sibling-group fanout measured (N logical refetches); cost and freshness need evidence. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-card-clarity`: Next Week read order in the product accordion.
