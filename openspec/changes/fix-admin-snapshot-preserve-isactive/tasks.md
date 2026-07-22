# Tasks

## 1. Pin current (broken) behavior

- [ ] 1.1 Add a characterization/regression test in the api's admin
      snapshot integration suite (`admin.integration.test.ts`): deactivate a
      seeded user (`isActive: false`), call `getSnapshot`, delete that
      user's row (fresh-DB path), call `saveSnapshot` against the resulting
      snapshot, then assert the restored user's `isActive` is `false` (this
      test fails against current code and pins
      `apps/api/src/modules/admin/admin-snapshot-write.queries.ts:92`).

## 2. Fix upsertUsers

- [ ] 2.1 Add `isActive: user.isActive` to the `create` data object in
      `upsertUsers` (`admin-snapshot-write.queries.ts:92-106`).
- [ ] 2.2 Add `isActive: user.isActive` to the `update` data object in
      `upsertUsers` (`admin-snapshot-write.queries.ts:78-90`).
- [ ] 2.3 Re-run the test from Task 1 and confirm it now passes.
- [ ] 2.4 Add a second case covering the update branch: restore the same
      deactivated-user snapshot into a DB where that user's row already
      exists with `isActive: true`, and assert it flips to `false`.

## 3. Confirm no regression on existing restore scenarios

- [ ] 3.1 Re-run the existing `admin-snapshot-restore` integration/unit
      tests (head-assignment, policy-linkage scenarios) to confirm this
      change is isolated to `upsertUsers` and does not alter other restore
      behavior.

## 4. Spec delta

- [ ] 4.1 `admin-snapshot-restore`: ADD the requirement that whole-snapshot
      restore preserves each user's `isActive` flag on both the create and
      update branch.

## Gates

- [ ] `pnpm --filter @customreport/api db:generate`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `cd apps/api && pnpm test:integration`
- [ ] `openspec validate fix-admin-snapshot-preserve-isactive --strict`
