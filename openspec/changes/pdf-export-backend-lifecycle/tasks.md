## 1. Slice A — terminal-attempt guard on PDF export failures

- [x] 1.1 `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`: in
      `onJobFailed`, compute `attemptsUsed = job.attemptsMade + 1` and
      `maxAttempts = job.opts.attempts ?? 1` (mirroring
      `email-reminder.processor.ts:111-130`) and only call `markExportFailed`
      when `attemptsUsed >= maxAttempts`
- [x] 1.2 Extend `apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts`:
      assert a non-terminal failed attempt does not call `markExportFailed`;
      assert the terminal attempt does

## 2. Slice B — DI-managed SessionRevocationService, no unmanaged Redis clients

- [x] 2.1 `apps/api/src/main.ts`: replace the `new SessionRevocationService(undefined, envConfig)`
      at line 443 with `app.get(SessionRevocationService)`, following the
      pattern documented in `bull-board.module.ts:107-114`
- [x] 2.2 `apps/api/src/infrastructure/trpc/trpc.context.ts`: replace the
      `new SessionRevocationService(undefined, _app.get<EnvConfig>(ENV_CONFIG))`
      at line 221 with `_app.get(SessionRevocationService)`; remove the
      now-inaccurate "constructed once; uses lazyConnect" comment
- [x] 2.3 Confirm `SessionRevocationService` is exported by the module that
      provides it (per `bull-board.module.ts`'s comment: "provided+exported
      by AdminModule") and reachable from both `main.ts`'s app instance and
      the tRPC context factory's app instance
- [x] 2.4 Extend `apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts`
      and `apps/api/src/infrastructure/trpc/pdf-export-session.test.ts`:
      assert the context factory resolves the DI singleton (e.g. via a spy on
      `app.get`) rather than constructing a new instance
- [x] 2.5 `grep -rn "new SessionRevocationService" apps/api/src` returns zero
      hits after 2.1–2.2

## 3. Slice C — required `requestedBy` on ownership check

- [x] 3.1 `apps/api/src/modules/pdf-export/pdf-export.service.ts`: change
      `getPdfExportStatus(jobId, requestedBy?)` to require `requestedBy`
      (drop the `?`); the ownership check
      `job.requestedBy !== requestedBy` now always runs
- [x] 3.2 `apps/api/src/infrastructure/trpc/routers/pdf-export.router.ts`:
      confirm the `status` procedure's existing `ctx.session.userId` argument
      still satisfies the now-required parameter (no call-site change
      expected; typecheck confirms)
- [x] 3.3 Extend `apps/api/src/modules/pdf-export/pdf-export.service.test.ts`:
      assert `getPdfExportStatus` rejects/denies when the caller does not own
      the job, with no way to bypass via an omitted argument

## 4. Slice D — count requests after a successful enqueue

- [x] 4.1 `apps/api/src/modules/pdf-export/pdf-export.service.ts`: move
      `customreportPdfExportRequestsTotal.inc(...)` from before
      `pdfQueue.add(...)` to after it succeeds
- [x] 4.2 Extend `apps/api/src/modules/pdf-export/pdf-export.service.test.ts`:
      assert the counter is not incremented when the enqueue call throws

## 5. Slice E — group-scope check at request time

- [x] 5.1 `apps/api/src/modules/pdf-export/pdf-export.service.ts`: add a
      `canReadReport(session, reportId)`-shaped scope check in
      `requestPdfExport`, reusing the existing scope-check pattern from
      `analytics`/`telemetry`, rejecting before any `pdfQueue.add` call
- [x] 5.2 Extend `apps/api/src/modules/pdf-export/pdf-export.contract.test.ts`
      and/or `pdf-export.service.test.ts`: assert a request for a report
      outside the caller's group is rejected before enqueue

## 6. Spec delta

- [x] 6.1 `pdf-export-integrity`: ADD a requirement that a PDF export job's
      DB status only reaches `failed` on the terminal BullMQ attempt
- [x] 6.2 `pdf-export-integrity`: ADD a requirement that PDF export status
      reads always enforce caller ownership
- [x] 6.3 `pdf-export-integrity`: ADD a requirement that PDF export requests
      are rejected up front for reports outside the caller's group
- [x] 6.4 `redis-connection-config`: ADD a requirement that every Redis-backed
      service instance is DI-managed, not constructed with `new`

## 7. Gates and verification

- [x] 7.1 `pnpm --filter @customreport/api db:generate`
- [x] 7.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 7.3 `cd apps/api && pnpm test:integration`
- [x] 7.4 `grep -rn "new SessionRevocationService" apps/api/src` — zero hits
- [x] 7.5 `openspec validate pdf-export-backend-lifecycle --strict`
