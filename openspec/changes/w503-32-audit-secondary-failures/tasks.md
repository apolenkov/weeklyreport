# Tasks

- [x] 1. Spec delta for `operational-logger-wiring`.
- [x] 2. RED unit test `mutation-audit.secondary-failure.test.ts`: three secondary failures replace the result with INTERNAL_SERVER_ERROR, control passes.
- [x] 3. Policy confirmed (Root, Fable ANSWER-1817): post-outcome only, independent stream and durable attempts, guarded disclosure, one stderr line as last resort.
- [x] 4. Repair in `trpc.audit.ts`: the stream emit and the durable write are separate attempts; metric and error log are guarded on their own; a failed error log writes one stderr line. `audit-logger.ts` per-flow policy and fail-closed login/admin/cron stay open.
- [ ] 5. GREEN, six gates, independent review.
