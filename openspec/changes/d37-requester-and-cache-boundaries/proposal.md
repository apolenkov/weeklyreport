# Proposal

## Why

Denied PDF requesters can inherit a development head identity, blank organization names pass direct API validation, and broad cache invalidation deletes its freshness fence. D37-V07 claims C0523/C0524, C3636 and F540-5 identify these boundaries in the existing factory, shared brand schemas and cache helper; genuine focused RED receipts are retained in the coordinator handoff.

## What Changes

- Stop resolution after valid PDF claims whose requester is logically denied.
- Require meaningful content in both organization brand fields without transforming nonblank values.
- Preserve the helper's generation metadata during every prefix scan.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: clarify terminal denial of a valid requester's token.
- `admin-settings-ui`: align direct organization input with the form's nonblank identity requirement.
- `analytics-query-correctness`: retain cache freshness metadata during prefix invalidation.

## Impact

Changes are confined to existing context resolution, shared schemas and the cache helper, with colocated regressions. No public payload, dependency or database schema changes.

## Non-goals

- Redefining invalid-token or ordinary development authentication.
- Mapping logical denial to HTTP500 or swallowing technical hydration failures.
- Trimming existing names, broad charset restrictions or a data migration.
- Redesigning distributed cache outage recovery or adding singleflight.
