# Tasks

- [x] 1. Spec delta for `operational-logger-wiring`.
- [x] 2. RED unit test `mutation-audit.secondary-failure.test.ts`: three secondary failures replace the result with INTERNAL_SERVER_ERROR, control passes.
- [ ] 3. API owner confirms the best-effort policy for audit reporting failures.
- [ ] 4. Repair in `trpc.audit.ts` (guard the emit and the catch reporting); `audit-logger.ts` per-flow policy stays open (separate grant and claim).
- [ ] 5. GREEN, six gates, independent review.
