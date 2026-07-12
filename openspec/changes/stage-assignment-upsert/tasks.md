## 1. Atomic upsert

- [ ] 1.1 `apps/api/src/modules/admin/admin-group.queries.ts`: replace the
      `findFirst` read plus branching `create`/`update` in `saveStageAssignment`
      with a single `prisma.stageAssignment.upsert` call, keyed on the
      composite unique `stageId_projectId` (Prisma's generated compound-key
      name for `@@unique([stageId, projectId])`)
- [ ] 1.2 `create` passes the full `{ userId, stageId, projectId }` input;
      `update` sets only `userId` (matches the current behavior: a reassign
      changes the assignee, never the stage/project pair); both branches keep
      the existing `include: { stage: { select: { name: true } }, user: {
select: { name: true } } }` so the return shape is unchanged
- [ ] 1.3 Keep `stageAssignmentSchema.parse(...)` mapping of the returned row
      exactly as-is — only the write strategy changes, not the response shape

## 2. Spec delta

- [ ] 2.1 `admin-stage-assignment` (new capability): ADD a requirement that
      `saveStageAssignment` writes are atomic against the `stageId_projectId`
      unique constraint

## 3. Tests

- [ ] 3.1 `apps/api/src/modules/admin/admin.integration.test.ts` (real
      Postgres via `createTestPrisma`/`seedTestData`): seed one `Stage` row,
      then call `saveStageAssignment` twice with the same `stageId`/`projectId`
      and different `userId`s via `Promise.all` — assert both calls resolve
      (no thrown `P2002`) and exactly one `StageAssignment` row exists for
      that stage/project pair afterward, with `userId` matching one of the two
      concurrent callers
- [ ] 3.2 Keep the existing sequential create/update/delete/list coverage in
      `apps/api/src/modules/admin/stage-assignment.integration.test.ts`
      unchanged (it exercises `AdminService` against an in-memory repository
      fake, not the Prisma query itself, so it is unaffected by this change)

## 4. Verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 `pnpm test:integration` (single-threaded, real Postgres) — confirms the new concurrent-upsert test passes and no other integration test regresses
- [ ] 4.4 `openspec validate stage-assignment-upsert --strict`
