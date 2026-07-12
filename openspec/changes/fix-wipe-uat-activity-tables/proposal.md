## Why

Wave 1 / P1 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`prisma/wipe-manual-uat.ts` performs the manual-UAT reseed (the
`RESEED_VARIANT_MANUAL_UAT` branch of the admin reseed procedure in
`apps/api/src/infrastructure/trpc/trpc.router.ts`). It wipes and reseeds inside
a single `$transaction`, but its delete map predates the project-activity
feature and omits all four activity tables: `activityStatus`,
`projectActivityLead`, `projectActivityProduct`, and `projectActivity`.

Those omissions are fatal, not cosmetic. `ProjectActivity.groupId` is
`ON DELETE RESTRICT` (init migration `ProjectActivity_groupId_fkey`), so
`reportingGroup.deleteMany` fails whenever activity rows exist; and
`ProjectActivityProduct.productId` is `ON DELETE RESTRICT`
(`ProjectActivityProduct_productId_fkey`), so `project.deleteMany` fails the
same way. Because the wipe and reseed share one transaction, either FK
violation rolls the whole thing back — the database is left exactly as it was
and nothing is reseeded.

The standard seed (`prisma/seed-simple.ts`) seeds activity rows
unconditionally, so every database this script targets contains activity rows.
The script is therefore completely non-functional against its primary target.
It is transactional and prod-guarded (`assertNonProdDestructive`), so the
failure aborts cleanly with no partial corruption — but the manual-UAT reseed
never succeeds. `seed-simple.ts` already wipes these four tables in FK-safe
order; `wipe-manual-uat.ts` simply never caught up.

## What Changes

- `prisma/wipe-manual-uat.ts`: insert the four project-activity deletes into
  the transactional wipe map, in FK-safe order, between the report-section
  content deletes and the `project` / `reportingGroup` deletes. The order
  mirrors `seed-simple.ts`: `activityStatus` → `projectActivityLead` →
  `projectActivityProduct` → `projectActivity` (statuses reference their
  activity; activities reference their reporting group and are `RESTRICT`, so
  they must be gone before `reportingGroup.deleteMany` and `project.deleteMany`
  run). Each delete records its count in the existing `CountMap`.
- No change to the transaction boundary, the destructive guard, the reseed
  block, or any other script. The fix is additive: four missing deletes in the
  correct position.

## Capabilities

### New Capabilities

- `manual-uat-reseed`: the `wipe-manual-uat.ts` transactional wipe must delete
  every FK-dependent table in FK-safe order so the wipe+reseed completes on a
  database provisioned by the standard seed.

### Modified Capabilities

(none)

## Impact

- `prisma/wipe-manual-uat.ts`

Non-goals: no switch to a `TRUNCATE CASCADE` strategy (`reset-hard.ts`'s
approach is immune to list drift but is out of scope here — the surgical fix is
to complete the delete list); no change to `seed-simple.ts`, `seed-demo.ts`, or
the reseed procedure; no new drift-guard test asserting the wipe list stays in
sync with the schema.
