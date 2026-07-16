# Tasks

## 1. Characterization pins

- [x] 1.1 Pin current post-publish side-effect behavior for `PeriodService.publishPeriod`: telemetry pair with `from` label = actual prior status, no emission on raced/archived outcomes, ingestion errors swallowed, cache invalidated
- [x] 1.2 Pin the same for `PublicationService.publishAuto` (incl. the `{published:false}` skip emitting nothing) — reuse existing tests where they already pin it; add only what is missing

## 2. Side-effect seam

- [x] 2.1 Create `apps/api/src/modules/period/application/publish-side-effects.ts` with the single `IngestionPublishHook` type and the emission function per design decision 1
- [x] 2.2 Route `PeriodService.publishPeriod` through it; delete the private `emitPublishSideEffects` and the local hook type
- [x] 2.3 Route `PublicationService.publishAuto` through it (DI per design decision 2 if the import zone fires); delete the local hook type and inline tail
- [x] 2.4 Update composition wiring in `period.module.ts` / publication providers

## 3. Dead surface removal

- [x] 3.1 Verify with a repo-wide grep that `review.publish` and `publishReport` have no callers outside `review.router.ts` and their tests
- [x] 3.2 Delete the `review.publish` procedure and `PublicationService.publishReport`; prune `review-publish-target.test.ts` publish case, ensuring `period.publish` router tests still pin DB-resolved-target behavior (add the equivalent case there if missing)

## 4. Gates

- [x] 4.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`
- [x] 4.2 `pnpm lint`
- [x] 4.3 `pnpm test`
- [x] 4.4 `pnpm test:integration`
