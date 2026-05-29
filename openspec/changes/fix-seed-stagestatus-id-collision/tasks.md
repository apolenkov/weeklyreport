# Tasks

Gates after the change: `pnpm typecheck && pnpm lint && pnpm test` + a clean
`pnpm db:fresh:advanced` run.

## Fix the id generation

- [x] Add a `stageStatusId(leadIndex, prodSeq, stageSeq)` helper in
      `prisma/seed.ts` alongside `projectStatusId`, zero-padding each field to a
      fixed width (`f0` + lead(2) + prod(4) + stage(4) = 12 hex chars) so
      distinct tuples never collide and the value stays a valid UUID tail.
- [x] Replace the inline `create.id` template at the `stageStatus.upsert` call
      with `stageStatusId(cfg.leadIndex, pIdx + 1, offset + 1)`.

## Fix the ReminderRule duplicate upsert

- [x] Change the `reminderRule.upsert` `where` from `{ id }` to the natural key
      `{ reportId_policyId: { reportId, policyId } }` so it updates the
      seed-simple baseline row instead of creating a `(reportId, policyId)`
      duplicate (`P2002`).

## Fix `tsx` resolution for db:fresh scripts

- [x] Declare `tsx` in root `devDependencies` (matching `apps/api`'s `^4.22.3`)
      so `db:fresh:simple` / `db:fresh:advanced` resolve bare `tsx` at the repo
      root; run `pnpm install`.

## Verify

- [x] `pnpm db:fresh:advanced` completes without `P2002` and prints its summary
      (verified: `tsx v4.22.3`, `Seeded: …`, exit 0).
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
