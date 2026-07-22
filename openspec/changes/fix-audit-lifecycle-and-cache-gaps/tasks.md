## 1. Scheduled-to-open flip runs when auto-create is disabled

- [ ] 1.1 Move `flipDueScheduledToOpen` in `apps/api/src/modules/period/infrastructure/period-creator.scheduler.ts` before the `autoCreatePeriods` early return, preserving the existing guarded `buildTransition('open', {})` write path and leaving disabled period creation unchanged.
- [ ] 1.2 Extend `apps/api/src/modules/period/infrastructure/period-creator.scheduler.test.ts` with a scheduler case that sets `autoCreatePeriods=false`, supplies a due `scheduled` row, and asserts that the row flips to `open` while no new period is created.
- [ ] 1.3 Add integration coverage proving the disabled-creation tick persists the full governed scheduled-to-open transition and does not create a report.
- [ ] 1.4 Implement the `period-scheduler-wiring` delta requirement that due scheduled periods open independently of automatic period creation.

## 2. Auto-publish invalidates analytics cache

- [ ] 2.1 Make `invalidateAnalyticsCache` a required `PublishSideEffectsDeps` member in `apps/api/src/modules/period/application/publish-side-effects.ts`, remove the optional guard, and update all callers/tests to provide it explicitly.
- [ ] 2.2 Inject `AnalyticsCache` into the `PublicationService` factory in `apps/api/src/modules/publication/publication.module.ts` and pass its invalidation callback into `PublicationService.publishAuto`'s `emitPublishSideEffects` dependencies.
- [ ] 2.3 Add unit coverage proving `publishAuto` invokes analytics invalidation after a successful publish and does not silently omit the required dependency.
- [ ] 2.4 Add an integration test that first caches an analytics result, executes `publishAuto`, then asserts the next analytics read recomputes and does not serve the cached pre-publish result.
- [ ] 2.5 Implement the `analytics-query-correctness` delta requirement that every successful publish path invalidates analytics cache entries.

## 3. Publish success invalidates the lead-form client cache

- [ ] 3.1 Add `invalidateLeadForm` to publish success in `apps/web/src/features/report-pages/ui/use-weekly-report-mutations.ts`, preserving the existing dashboard/history invalidations and success toast.
- [ ] 3.2 Add `invalidateLeadForm` to publish success in `apps/web/src/features/period/ui/head-publish-lock-action.tsx`, preserving the existing dashboard/history invalidations and success toast.
- [ ] 3.3 Add or extend web unit tests for both publish entry points to assert `invalidateLeadForm` runs on success and does not run on failure.

## 4. Action-log keyset pagination has a total order

- [ ] 4.1 Change `ActionLogPrismaRepository.listActionLog` to `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`, keeping the existing cursor, page size, and response contract.
- [ ] 4.2 Update `ActionLogRepository.listActionLog`'s contract comment to describe newest-first composite keyset pagination using `createdAt` with `id` as the unique tiebreaker.
- [ ] 4.3 Add repository integration coverage with multiple rows sharing one `createdAt`; traverse consecutive pages and assert stable `createdAt DESC, id DESC` order with no skipped or duplicated ids.

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck`
- [ ] 5.3 `pnpm lint`
- [ ] 5.4 `pnpm test`
- [ ] 5.5 `pnpm test:e2e:integration`
- [ ] 5.6 `/opt/homebrew/bin/openspec validate fix-audit-lifecycle-and-cache-gaps --strict`
