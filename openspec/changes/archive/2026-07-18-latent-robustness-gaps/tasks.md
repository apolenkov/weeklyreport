## 1. `ensure-lead-section`: transactional create + seed

- [x] 1.1 `apps/api/src/modules/report-sections/application/ensure-lead-section.ts`:
      wrap `reportSection.create` + `seedProjectStatuses` +
      `seedActivityStatuses` in one `prisma.$transaction(async (tx) => { ... })`,
      threading `tx` through both seed calls instead of the outer `prisma`
- [x] 1.2 Confirm the existing unique-violation catch/re-read fallback still
      works when the create fails inside the transaction (the transaction
      rolls back cleanly, the outer catch still runs the `findUnique` re-read
      against the non-transactional `prisma`)
- [x] 1.3 Add a unit/integration test: a seed step throwing (e.g. mock
      `activityStatus.createMany` to reject) leaves NO `ReportSection` row
      committed, so a retried login can seed successfully

## 2. `reports.myHistory`: route through `mapDomainError`

- [x] 2.1 `apps/api/src/infrastructure/trpc/routers/reports.router.ts`: wrap
      `myHistory`'s body in `try { ... } catch (error) { throw mapDomainError(error); }`,
      matching `compiledHistory`'s existing pattern
- [x] 2.2 Add a unit test asserting a domain error thrown by
      `reportSectionsService.myHistory` surfaces as its typed tRPC error code,
      not a generic `INTERNAL_SERVER_ERROR`

## 3. Admin `dlqCount` / `retryFailed`: fail loud on unwired deps

- [x] 3.1 `apps/api/src/infrastructure/trpc/routers/admin/ops.procedures.ts`:
      add a `requireEmailReminderQueue` / `requireJobsService`-style helper
      mirroring `requireActionLogService`, and use it in `dlqCount` and the
      `retryFailed`-adjacent paths instead of the current fail-soft
      early-return / no-op
- [x] 3.2 Update/add tests: `dlqCount` and `retryFailed` throw (not return
      `0`/no-op) when their dependency is undefined

## 4. `/api/client-logs`: cap body size at the web hop

- [x] 4.1 `apps/web/src/app/api/client-logs/route.ts`: reject (e.g. `413` /
      `204` early-return, consistent with the route's existing best-effort
      error handling) a request body larger than a named constant matching
      the api-side `128kb` limit, before calling `req.text()` fully buffers
      an oversized body
- [x] 4.2 Add a route test posting an oversized body and asserting it's
      rejected without forwarding to the api

## 5. `useScrollFade`: recompute on content growth, not just container resize

- [x] 5.1 `apps/web/src/hooks/use-scroll-fade.ts`: add a `MutationObserver`
      (childList + subtree) on `el`, calling `check()` on mutation, alongside
      the existing `ResizeObserver` and scroll listener
- [x] 5.2 Add a test: appending child content to a fixed-height container
      (no container resize) still recomputes `canScrollDown`

## 6. carry-over: fix `recordType` discriminator

- [x] 6.1 `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts`:
      confirm the actual item/decision discriminant column (`targetItemId`
      vs `sourceItemId` vs an explicit type column) by reading the
      `CarryOverRecord` Prisma model, then key `recordType` off the correct
      field, both at line ~60-61 (count derivation) and line 311
      (`recordType: r.sourceItemId ? "item" : "decision"`)
- [x] 6.2 Add a test with a record whose current discriminator field is null
      but should still classify correctly

## 7. `_destructive-guard.ts`: parse `DATABASE_URL` with `new URL()`

- [x] 7.1 `prisma/_destructive-guard.ts`: replace the regex-based host
      extraction (`url.replace(/.*@/, "").split(/[:/]/)[0]`) with
      `new URL(url).hostname`, keeping the existing masking / refusal
      messages unchanged
- [x] 7.2 Add a test: a credential-less `DATABASE_URL`
      (`postgresql://host/db_test`) still correctly resolves `host` and
      applies the existing allow/refuse rules

## 8. Gates

- [x] 8.1 `pnpm --filter @customreport/api db:generate`
- [x] 8.2 `pnpm --filter @customreport/api test`
- [x] 8.3 `pnpm --filter @customreport/web test`
- [x] 8.4 `pnpm test:integration`
- [x] 8.5 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 8.6 Smoke: seed a lead with a project, log in fresh, confirm
      `ProjectStatus` rows exist (task 1's exact path)
- [x] 8.7 `openspec validate latent-robustness-gaps --strict`
