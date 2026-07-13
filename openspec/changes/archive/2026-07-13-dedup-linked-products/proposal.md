## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

A `linkedProductIds` payload with a repeated product id on
`projectActivity.create`/`update` throws an unhandled Prisma `P2002` instead
of a clean validation error. `projectActivityCreateSchema` and
`projectActivityUpdateSchema` (`packages/shared/src/schemas/project-activity.schema.ts`)
only bound the array's length; `project-activity.service.ts` only checks that
each id exists; neither dedupes. `project-activity.prisma-repository.ts`
builds `activityProducts.create` (create path) and the `toAdd` list fed to
`activityProductProduct.createMany` (update path) straight from the raw
array, so an in-payload duplicate collides with `ProjectActivityProduct`'s
`@@unique([activityId, productId])` constraint. `trpc.error-mapper.ts` has no
P2002 row for this constraint, so the collision falls through to
`INTERNAL_SERVER_ERROR` — an opaque 500 for what is, at the client, a
malformed-input error.

The endpoint is `adminProcedure`-gated with zero callers in `apps/web/src`
today, and the write is wrapped in a transaction that rolls back cleanly on
failure — no data corruption, just a poor error contract reachable only by a
hand-crafted tRPC payload. The repo's own standard elsewhere
(`report-sections.prisma-repository.ts`) is to surface this class of input
error as a clean 400, never an unhandled 500.

## What Changes

- `packages/shared/src/schemas/project-activity.schema.ts`: add a
  `.refine(ids => new Set(ids).size === ids.length, ...)` uniqueness check to
  the `linkedProductIds` field on `projectActivityCreateSchema` and
  `projectActivityUpdateSchema`, so a duplicate id is rejected as a `BAD_REQUEST`
  (400) at the wire boundary, before Prisma ever sees it.
- `apps/api/src/modules/project-activity/project-activity.prisma-repository.ts`:
  as defense-in-depth for any caller that bypasses the shared schema (e.g. a
  future internal caller), dedupe `linkedProductIds` before building the
  `create` payload, and add `skipDuplicates: true` to the update path's
  `projectActivityProduct.createMany` call.

No behavior changes for well-formed (already-unique) `linkedProductIds`
payloads.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — this adds a new requirement to `activity-reporting-unit`, it does not
change the meaning of an existing one)

## Impact

- `packages/shared/src/schemas/project-activity.schema.ts`
- `apps/api/src/modules/project-activity/project-activity.prisma-repository.ts`
- `apps/api/src/modules/project-activity/project-activity.service.spec.ts` (or
  equivalent unit test file) — new duplicate-id coverage
