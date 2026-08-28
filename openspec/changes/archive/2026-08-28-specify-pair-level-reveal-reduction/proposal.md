## Why

The exact Admin/demo canary at source `e657c5cf4207f7df16532e3e65f08fd33b9ed794`
fails closed at `8199 > 8192` while exploring `/admin → actions → two
row-local disclosures`. The existing three-step reduction cannot reach this
two-toggle suffix. Sol-approved offline simulation confirms deeper-only as a
negative control and identifies pair-level reduction as the only bounded,
decision-changing hypothesis; it requires at least seven avoided registrations
and is not live-proven. A separate contract is needed before any code or
runtime work can be considered.

## What Changes

- Define a pair-level reduction candidate scoped to an exact URL-changing
  prefix fingerprint and the existing source/plan/selector/state/route key.
- Require both directed orders for every pair, disjoint source-bound targets,
  equal URL and material surfaces, and complete before/after target metadata.
- Preserve both observed paths and every row-local control; keep the cap,
  modal/background, non-mutation, URL, and fail-closed guards unchanged.
- Require deterministic proof of registration savings before implementation;
  keep live binding, 5.19 acceptance, and CR-001 acceptance separate.

### Non-goals

- No cap increase, graph trimming, retry, path rewriting, or product/UI change.
- No browser, runtime, database, Redis, Docker, release, or visual acceptance.
- This delta and its deterministic proof do not authorize implementation. A
  separate implementation authorization is required; only then does a fresh
  code gate precede a separately authorized bounded exact-SHA canary.

## Capabilities

### New Capabilities

- `pair-level-reveal-reduction`: a fail-closed, prefix-scoped candidate for
  reducing proven reversible disclosure pairs while retaining replay evidence.

### Modified Capabilities

None.

## Impact

The eventual implementation would be limited to the runtime-sweep reveal
canonicalization/diagnostic layer and deterministic tests. It must not change
product routes, APIs, database schema, Redis behavior, dependencies, or
production configuration. The current change is specification and proof work
only; the source-bound simulation packet is retained outside Git under
`customreport-archive/2026-08-21-runtime-source-e657c5cf-admin-demo-5.19/`.
