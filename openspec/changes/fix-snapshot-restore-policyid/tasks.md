# Tasks

## 1. Pin current (broken) behavior

- [ ] 1.1 Add a characterization/regression test in the api's admin snapshot
      integration suite: seed a `ReminderPolicy` and a `ReminderRule` with
      that non-null `policyId`, call `getSnapshot`, then call `saveSnapshot`
      against an empty database, then assert the restored
      `ReminderRule.policyId` equals the original policy id (this test fails
      against current code and pins the fix).

## 2. Fix upsertReminderRules

- [ ] 2.1 Add `policyId: rule.policyId` to the `ruleData` object in
      `upsertReminderRules` (`admin-snapshot-write.queries.ts`) so it is
      persisted on both the `create` and `update` branches.
- [ ] 2.2 Re-run the test from Task 1 and confirm it now passes.

## 3. Confirm no regression on the existing head-assignment scenarios

- [ ] 3.1 Re-run the existing `admin-snapshot-restore` integration/unit tests
      (group head assignment scenarios) to confirm this change is isolated
      to `upsertReminderRules` and does not alter other restore behavior.

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm --filter @customreport/api test:integration`
