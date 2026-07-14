## 1. Scope telemetry to the caller's group

- [ ] 1.1 `telemetry.service.ts`: thread `session` into `getSummary` and any
      repository methods it calls
- [ ] 1.2 Apply `guardGroupScope(session)` + `groupScopeFilter(session, ...)`
      in each telemetry query, matching `analytics.prisma-repository.ts`'s
      pattern
- [ ] 1.3 If the telemetry summary is cached, add the group-scope
      discriminator to the cache key
- [ ] 1.4 If product review decides telemetry should stay org-wide instead,
      gate it to admin/department-head roles and document the exemption in
      the service — mutually exclusive with 1.1-1.3, pick one

## 2. Fix the viewer landing-default archived-report leak

- [ ] 2.1 `weekly-report.service.ts`: change the viewer branch of
      `resolveDefaultReportId` to call `getLatestPublishedNonArchivedId()`
      instead of `getLatestPublishedId()`

## 3. Tests

- [ ] 3.1 Unit test: `telemetry.getSummary` with a group-A-scoped session
      excludes group-B counts
- [ ] 3.2 Integration test: seed reports in two groups; group-A head's
      telemetry summary excludes group-B counts
- [ ] 3.3 Unit test: viewer-branch `resolveDefaultReportId` returns the
      non-archived resolver's result
- [ ] 3.4 Integration test: seed an archived published report as the only
      published report for a group; a viewer's `resolveDefaultReportId`
      does not resolve to it

## 4. Spec delta

- [ ] 4.1 `group-scope-isolation-gaps`: ADD requirements for telemetry group
      scoping and the viewer non-archived fallback; explicitly exclude
      lifecycle-mutation scope guards (declined product decision)

## 5. Gates

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `cd apps/api && pnpm test:integration`
- [ ] 5.4 `openspec validate group-scope-isolation-gaps --strict`
