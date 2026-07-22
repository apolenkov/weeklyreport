## Why

The 2026-07-22 mass review missed four lifecycle and cache-consistency gaps that can leave a due period editable under contradictory state, serve stale analytics for up to an hour after auto-publish, briefly retain an editable lead form after publish, or paginate the action log unstably. A third-vendor Grok audit found the four issues; four independent Opus verifications then checked them adversarially against live code and confirmed the calibrated severities below.

## What Changes

- **MEDIUM — scheduled-to-open lifecycle:** run `flipDueScheduledToOpen` on every period-creator scheduler tick, before the `autoCreatePeriods` early return. This is the least-invasive design: `autoCreatePeriods` continues to control creation only, while the existing transition module and `buildTransition` retain ownership of lifecycle writes.
- **MEDIUM — auto-publish analytics cache:** wire `AnalyticsCache` into `PublicationModule`, make `invalidateAnalyticsCache` a required publish-side-effect dependency, and pass it from `PublicationService.publishAuto`.
- **MINOR — publish client cache:** call `invalidateLeadForm` from both publish-success handlers, matching reopen behavior.
- **MINOR — action-log pagination:** order by `createdAt DESC, id DESC` and correct the repository contract comment to describe the composite keyset order.

## Evidence

1. `apps/api/src/modules/period/infrastructure/period-creator.scheduler.ts:158-167` returns when `autoCreatePeriods` is false before its only non-test call to `flipDueScheduledToOpen`; false is the schema default (`prisma/schema.prisma:707`). Scheduled creation does not set `periodStatus`, so its database default remains `open`. Once `periodStart <= now`, the editable-id query admits the row by `periodStatus`, while admin still renders `periodState` as `scheduled` (`apps/web/src/features/period/ui/periods-tab-table.tsx:109`) and hides Publish (`apps/web/src/features/period/ui/periods-action-icon-row.tsx:60`). The row otherwise skips `open` only when auto-published after its deadline.
2. `PeriodService.publishPeriod` supplies cache invalidation and reopen invalidates it directly (`apps/api/src/modules/period/application/period.service.ts:202,306`), but `PublicationService.publishAuto` omits it (`apps/api/src/modules/publication/application/publication.service.ts:213-234`) and `PublicationModule` has no `AnalyticsCache` dependency (`apps/api/src/modules/publication/publication.module.ts:25-36`). The optional guard silently accepts the omission (`apps/api/src/modules/period/application/publish-side-effects.ts:75`); the cache TTL is 3600 seconds (`apps/api/src/modules/analytics/analytics.cache.ts:11`), and all three analytics reads use `getOrCompute` (`apps/api/src/modules/analytics/analytics.service.ts:98,110,122`).
3. Publish invalidates dashboard and history only (`apps/web/src/features/report-pages/ui/use-weekly-report-mutations.ts:31-34`, `apps/web/src/features/period/ui/head-publish-lock-action.tsx:46-49`), unlike reopen, which also invalidates the lead form. The lead-form query stays fresh for 30 seconds and refetches on window focus (`apps/web/src/features/report-pages/ui/use-lead-form-data.ts:79-80`); server save rejection remains authoritative and visible by toast.
4. The action-log contract claims keyset pagination on `id` (`apps/api/src/modules/admin/action-log.service.ts:28`), but Prisma uses an `id` cursor with non-unique `createdAt DESC` ordering (`apps/api/src/modules/admin/action-log.prisma-repository.ts:14-19`). Equal timestamps can therefore skip or duplicate rows across pages.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `period-scheduler-wiring`: due scheduled periods must transition to open independently of automatic period creation.
- `analytics-query-correctness`: every successful publish path must invalidate the analytics cache.

## Non-goals

- No change to `autoCreatePeriods` behavior beyond decoupling the due scheduled-to-open flip from period creation.
- No analytics cache redesign, TTL change, or new cache-key scheme.
- No action-log pagination API, cursor shape, page-size, or response-shape change.

## Impact

The implementation affects the period-creator scheduler, publication composition and side effects, two web publish-success handlers, and action-log repository ordering. It changes no Prisma schema, shared API contract, role middleware, or database migration.

## Verification

- Scheduler unit/integration coverage proves a due scheduled row flips through the governed transition when `autoCreatePeriods=false`, without creating a new period.
- Publication integration coverage warms an analytics read before `publishAuto`, publishes, then proves the cached pre-publish value is not served by the next read.
- Web tests pin `invalidateLeadForm` in both publish `onSuccess` handlers.
- Repository integration coverage pages across rows sharing the same `createdAt` and proves every row appears exactly once in `createdAt DESC, id DESC` order.
- Run `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e:integration`, and `openspec validate fix-audit-lifecycle-and-cache-gaps --strict`.
