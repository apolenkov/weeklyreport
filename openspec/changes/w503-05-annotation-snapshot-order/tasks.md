# Tasks

- [x] 1. Spec delta for `authenticated-product-feedback`.
- [x] 2. RED integration test `agentation-reads.integration.test.ts`: eight equal-timestamp captures through `addAnnotation`, snapshot order equals server-ID order on two reads; control for distinct timestamps.
- [x] 3. Run RED on a guarded lane (Root window).
- [x] 4. Repair: `getSession` annotations `orderBy: [{ timestamp: "asc" }, { id: "asc" }]` in `agentation.repository.reads.ts` only (008 GO).
- [ ] 5. GREEN on the same lane, six gates, independent review.

The RED shows the missing ID tie-break (order differs from server-ID order);
it does not claim that reads differ from each other on main. A stable snapshot
order does not prove that the stock Agentation client syncs differently; that
stays a native observation.
