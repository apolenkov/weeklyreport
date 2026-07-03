## 1. Worker trace + correlation propagation (error-trace-correlation)

- [x] 1.1 At each `queue.add` (pdf-export, email-reminder, telegram-outbound),
      inject the active W3C `traceparent` and the CLS `correlationId` into job
      data.
- [x] 1.2 In each worker processor, extract that context, start a span linked to
      the enqueue trace, and run the body inside a `nestjs-cls` scope seeded with
      the `correlationId`.
- [x] 1.3 Replace hand-built `process.stderr` JSON in the worker processors with
      `AppLogger`, so worker logs carry `correlationId`/`traceId` and reach
      OTLP/Loki and the file sink.
- [x] 1.4 Add per-step duration logs to `pdf-export.processor.ts` and an explicit
      timeout on `page.goto`.
- [x] 1.5 Tests: a worker span links to the enqueue trace; a worker failure log
      is produced by `AppLogger` with the job `correlationId`; PDF export emits
      step timings and `page.goto` carries a timeout.

## 2. DLQ / queue monitoring (queue-reliability-monitoring)

- [x] 2.1 In `dlq-monitor.service.ts`, parse `DLQ_ALERT_THRESHOLD` with
      `Number.isFinite` fallback to the default (5) and a warn log naming an
      invalid value.
- [x] 2.2 Add `telegram-outbound` to `QUEUE_NAMES` so the existing
      `QueueEvents` listener counts its terminal failures into
      `cr_dlq_failed_total` and the threshold poll covers it; mark that
      entry (the new activation point) with `TODO(Phase 55)` per the
      deferred-feature convention.
- [x] 2.3 Do NOT add a second `cr_dlq_failed_total{queue="telegram-outbound"}`
      increment from a telegram worker handler — the DLQ monitor is the single
      owner of the counter, and a worker-side increment would double-count
      terminal failures.
- [x] 2.4 Lifecycle-manage the two Bull Board `Queue` instances so they `close()`
      on application shutdown (DI provider or `onModuleDestroy`).
- [x] 2.5 Tests: invalid threshold falls back and warns; a terminal telegram
      failure increments the counter exactly once (no double-count); Bull Board
      queues close on shutdown.

## 3. Hot-path query performance (hot-path-query-performance)

- [x] 3.1 `Promise.all` the independent `leadUsers` and `projects` queries in
      `getWeeklyReport` (`weekly-report.prisma-repository.ts`).
- [x] 3.2 Move archive-listing pagination into the repository
      (`archive.prisma-repository.ts`) using the existing `reportId` cursor /
      `nextCursor` contract — Prisma `cursor: { id }` + `skip: 1` with stable
      `orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }]` and `take: limit + 1`
      so a probe row decides `nextCursor` (return only `limit` items; `nextCursor`
      is the last kept row's `reportId` iff the probe row came back, else `null`)
      — and load the nested section graph only for snapshot-less fallback rows.
      DONE with a deliberate improvement: implemented as a keyset cursor
      (base64 `publishedAt|id` token, `archive-cursor.ts`) rather than
      `cursor:{id}`+`skip:1` — survives a deleted row; intent (probe-row page +
      lazy fallback graph) fully met (landed in `0e62e92d`).
- [x] 3.3 Replace the per-user count+delete loop in `upsertUsers`
      (`admin-snapshot-write.queries.ts`) with a bulk prefetch plus a single
      `deleteMany`. SUPERSEDED: the N+1 count+delete loop was removed
      wholesale by the additive-only restore in `4455edb1`; `upsertUsers` now
      does a bulk `findMany` prefetch with no destructive reconcile, so the
      specific `deleteMany` (and its 3.6 test) are moot — there is no loop left.
- [x] 3.4 Read the organization with `findUnique` in
      `organization.prisma-repository.ts`, falling back to create only when the
      row is absent (no write-on-read on the anonymous landing path).
- [x] 3.5 Gate the logger directory prune (`lib/logger.ts`) behind a rotation
      event or a timer instead of running it per log line.
- [x] 3.6 Tests: both report queries dispatch concurrently; archive cursor
      pagination reads only the page plus one probe row, returns at most `limit`
      items with `nextCursor` set iff a further page exists, resumes from the
      `reportId` cursor, returns `nextCursor: null` on the last/missing-cursor
      page, and loads the section graph only for fallback rows;
      `upsertUsers` issues one `deleteMany`; organization read performs no write
      when the row exists; the logger does not prune per line.

## 4. Verification

- [x] 4.1 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green.
- [x] 4.2 `openspec validate observability-and-perf-hardening --strict` exits 0.
