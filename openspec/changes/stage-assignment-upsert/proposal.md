## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`saveStageAssignment` (`apps/api/src/modules/admin/admin-group.queries.ts`)
does a `findFirst`-then-`create`/`update` against `StageAssignment`, which
already carries `@@unique([stageId, projectId])` in `prisma/schema.prisma`.
Two concurrent reassign calls for the same stage/project both see
`existing == null`, both attempt `create`, and the loser raises a raw
`P2002` that no mapper here converts — surfacing as an unhandled 500 instead
of the intended idempotent upsert. No migration is needed: the composite
unique constraint already exists; this is an api-only fix that makes the
write atomic against it.

## What Changes

- `apps/api/src/modules/admin/admin-group.queries.ts`: replace
  `saveStageAssignment`'s `findFirst` + branching `create`/`update` with a
  single `prisma.stageAssignment.upsert` keyed on the composite unique
  `stageId_projectId`, so a concurrent reassign of the same stage/project
  resolves atomically instead of racing on the unique constraint.
- No schema or migration change: `@@unique([stageId, projectId])` already
  exists and is reused as the upsert key.
