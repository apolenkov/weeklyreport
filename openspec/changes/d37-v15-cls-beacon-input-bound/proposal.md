# Proposal

## Why

A public CLS beacon with value 300000 currently reaches the real histogram. CLS is a dimensionless score, while the same maximum is expressed in milliseconds for timing metrics. The coordinator approved 10 as an input validation ceiling to protect aggregate integrity.

## What Changes

- Reject CLS values above 10 before metric observation, with the issue attributed to `value`.
- Preserve inclusive CLS values 0–10 and timing values 0–300000.
- Exercise the actual controller and histograms alongside the shared schema.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `public-endpoint-resource-limits`: make the public beacon numeric bound metric-specific.

## Impact

Shared beacon schema and existing shared/API tests. The controller already parses before observing. Evidence and owner admission are in external D37-V15 handoff artifacts; owning contract is `openspec/specs/public-endpoint-resource-limits/spec.md`.

## Non-goals

- Performance thresholds, dashboard percentiles, histogram buckets, or timing cap changes.
- Other V15 name, null, traffic, or collection policies.
