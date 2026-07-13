## 1. Restore group head assignments in the snapshot write path

- [ ] 1.1 In `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`,
      add a new `applyGroupHeads(tx, groups)` function that, for each group
      in `snapshot.groups`, updates `reportingGroup.headUserId` to
      `group.headUserId ?? null`.
- [ ] 1.2 In `saveSnapshot`, call `applyGroupHeads(tx, snapshot.groups)`
      after `upsertUsers` and before `upsertProjects`, inside the existing
      `$transaction` callback.
- [ ] 1.3 Leave `upsertGroups` unchanged (still create/update-only on
      `name`/`description`/`archived`) so every group row exists before the
      head-assignment pass runs.

## 2. Tests

- [ ] 2.1 In `apps/api/src/modules/admin/admin.integration.test.ts`, add a
      case that calls `saveSnapshot` with a group whose `headUserId` points
      at a user included in the same snapshot's `users` array, and asserts
      `getSnapshot` returns that `headUserId` on the restored group.
- [ ] 2.2 Add a case that restores a snapshot where a previously-headed
      group's `headUserId` is `null`, and asserts the stored group's
      `headUserId` is cleared to `null`.
- [ ] 2.3 Add a case that restores a snapshot into an existing DB where a
      group's `headUserId` changes from one user to another, and asserts the
      new value is applied (not left at the pre-restore value).

## 3. Verification

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 3.3 `pnpm test:integration`
- [ ] 3.4 `npx openspec validate admin-snapshot-head-restore --strict`
