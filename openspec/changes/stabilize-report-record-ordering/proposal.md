## Why

Equivalent reset/reseed loads can render the same report records in different
orders, so numbered controls such as `Edit decision:1` can target different
decisions in fresh browsers. R193 proved this with identical `151/151` control
observations but a permuted Decisions `visibleText`; the unordered relations in
`report-sections.include.ts` and the random second decision identity in
`seed-simple.sections.ts` explain the drift.

## What Changes

- Define one deterministic total order for report-section items, risks, and
  decisions at the API read boundary.
- Preserve each record's durable identity across saves and give canonical seed
  records deterministic primary and stable identities across reset/reseed.
- Add regressions proving repeated equivalent reads and seeded rebuilds keep
  record order and occurrence-bound controls stable.
- Bind each editable decision occurrence to its existing durable `stableId` in
  the non-visible, content-addressed runtime inventory.
- Keep the runtime-sweep genesis equality strict and improve its mismatch
  diagnostic; ordering drift remains a blocking product finding.

Non-goals:

- Adding drag-and-drop/manual ranking, a new database position column, or a
  migration.
- Sorting records by mutable user-facing text or silently canonicalizing away
  meaningful DOM differences in the runtime harness.
- Changing record authorization, write semantics, or published snapshot scope.

## Capabilities

### New Capabilities

- `report-record-ordering`: Deterministic, identity-stable ordering of report
  section record collections across reads, saves, and equivalent seed rebuilds.

### Modified Capabilities

None.

## Impact

The change affects the Prisma report-section include contract, deterministic
seed identities, focused repository/seed tests, and the R188/R193 genesis
inventory contract. The lineage-aware inventory advances the continuation
wire/hash domain from v4 to v5, so legacy v4 assets are intentionally rejected.
It adds no API fields, dependency, migration, or production data operation.
Evidence originates from
`2026-08-15-exhaustive-runtime-sweep-r193-pro-b2ca739b` and remains outside Git.
