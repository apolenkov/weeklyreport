## 1. Canonical seed produces paused and postponed items

- [ ] 1.1 In `prisma/seed.ts`, give at least one current-period item across
      `activeLeadConfigs` a `workflowStatus` of `ItemWorkflowStatus.paused`
      instead of only cycling `in_progress`/`done` (the schema comment at
      `schema.prisma` confirms `current → in_progress | paused | done` is the
      valid set). Leave `pausedReason` unset, matching `seed-simple.ts` and
      `seed-demo.ts`.
- [ ] 1.2 In the same file, give at least one next-period item a
      `workflowStatus` of `ItemWorkflowStatus.postponed` instead of the
      hardcoded `planned` (schema comment: `next → planned | postponed`).
- [ ] 1.3 Keep both changes deterministic — no run-time randomness — and keep
      every other current/next item's existing id, text, and status
      unchanged so E2E and unit fixtures pinned to `seed.ts` stay valid.

## 2. Canonical seed runs the coverage guard

- [ ] 2.1 Import `assertSeedCoverage` from `./seed-coverage-check.js` in
      `prisma/seed.ts`.
- [ ] 2.2 Call `await assertSeedCoverage(prisma, "seed")` at the end of
      `main()`, after the existing summary `console.log`, mirroring the call
      site in `seed-simple.ts` and `seed-demo.ts`.

## 3. Verification

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 3.3 `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm prisma migrate reset` then `pnpm db:seed` — confirm `main()` prints `[seed] Status coverage OK (statuses, alarms, ranks).` and does not throw
- [ ] 3.4 Fail-injection check: temporarily drop the added paused or postponed
      item, rerun `pnpm db:seed`, confirm `assertSeedCoverage` throws — then
      restore the item
- [ ] 3.5 Live-check: dev-login as the lead who owns the new paused/postponed
      items and confirm both statuses render with their correct UI treatment
- [ ] 3.6 `openspec validate seed-coverage-paused-postponed --strict`
- [ ] 3.7 Adversarial review of the diff before archiving
