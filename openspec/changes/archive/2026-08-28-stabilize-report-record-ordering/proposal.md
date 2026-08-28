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
- Prove the user-visible ordering contract through focused API/seed tests and
  WeeklyReport's bounded product acceptance contour.

Non-goals:

- Adding drag-and-drop/manual ranking, a new database position column, or a
  migration.
- Sorting records by mutable user-facing text.
- Changing record authorization, write semantics, or published snapshot scope.

## Capabilities

### New Capabilities

- `report-record-ordering`: Deterministic, identity-stable ordering of report
  section record collections across reads, saves, and equivalent seed rebuilds.

### Modified Capabilities

None.

## Impact

The change affects the Prisma report-section include contract, deterministic
seed identities, and focused repository/seed tests. It adds no API field,
dependency, migration, or production data operation. The historical R193
runtime finding remains discovery evidence only; the retired runtime platform
is not an acceptance dependency.
