## 1. Scheduler Fix

- [ ] 1.1 In `apps/api/src/modules/period/auto-publisher.scheduler.ts`, add
      `archived: false` to the `findMany` candidate `where` clause (after `status:
"draft"`, mirroring the auto-archiver spelling exactly)

## 2. Tests

- [ ] 2.1 In `apps/api/src/modules/period/auto-publisher.scheduler.test.ts`, add
      a test scenario: an archived draft report whose `deadline` is past the cutoff
      is NOT returned by `runOnce` and its state is unchanged after the tick
- [ ] 2.2 Confirm the existing auto-publisher tests still pass with the new guard
      (`pnpm test --filter @customreport/api -- auto-publisher`)

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` — no new type errors
- [ ] 3.2 Run `pnpm lint` — no new lint warnings or errors
- [ ] 3.3 Run `pnpm test` — full suite green
- [ ] 3.4 (Optional) Query the dev/UAT database for any existing corrupted rows
      (`archived=true AND periodStatus='published'`) and remediate if any are found
