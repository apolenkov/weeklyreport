# Refactor Type Cycle Clusters

## Why

Runtime dependency cruising is green, but the same repository graph with
`--ts-pre-compilation-deps` exits 27 and reports 27 `no-circular` violations in
9 connected clusters. The current ratchet prevents growth but leaves type
ownership and feature boundaries cyclic.

## What Changes

- Remove all nine connected type-cycle clusters without weakening
  dependency-cruiser or hiding edges.
- Land one connected cluster per commit with targeted behavior evidence and the
  exact `scripts/type-cycle-baseline.json` decrement.
- Permit explicit public API, wire-contract, product-behavior, schema, and seed
  changes where a clean ownership seam requires them.
- Require affected data-contract slices to coordinate with
  `refactor-seed-profile-ladder`.

## Non-goals

- Do not replace cycles with generic shared type bags, duplicated contracts,
  pass-through barrels, dynamic imports, or ignored paths.
- Do not conflate the unrelated unresolved-import rule with cycle completion.
- Do not preserve obsolete MVP behavior or persisted rows through adapters.
