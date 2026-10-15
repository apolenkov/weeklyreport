# Tasks

## 1. API

- [x] 1.1 Accept a transaction client in `queryLatestPublishedNonArchivedId` and export it from `modules/weekly-report`
- [x] 1.2 In `PeriodPrismaRepository.reopenPeriod`, when Head guards are on, fail with `PeriodScopeError` unless the target is the latest published inside the transaction
- [x] 1.3 Unit test: a newer published period at transaction time rejects the Head reopen without writes; update the reminder-policy reopen test mock
- [x] 1.4 Take the status-graph lock first in `PeriodPrismaRepository.publishPeriod`; unit test asserts the lock precedes the policy locks and the first read

## 2. Integration (DB, per Root ledger)

- [x] 2.1 `period.single-active-reopen.integration.test.ts`: assert A is rejected and B is the only reopened period
- [x] 2.2 Add the publish↔reopen interleave test (publication paused before commit, reopen resumed after it); its wait probe matches only the status-graph lane in the test database
- [x] 2.3 Run both integration tests on an admitted DB lane, GREEN with the fix (lane b, 607256c2, 27/27)
- [x] 2.4 RED proof on an admitted DB lane: the interleave test fails without the publish lock, and separately without the in-transaction latest-published re-check (lane b, a252b50f, GREEN 27/27, each mutant 1 failed on the PeriodScopeError assertion)

## 3. Verification

- [x] 3.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the reviewed tree (Air, 859941fbe)
- [ ] 3.2 Same six commands on the review follow-up tree
