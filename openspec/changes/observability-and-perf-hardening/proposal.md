## Why

Three P2 findings from the repo-excellence review converge on the API's
asynchronous and hot-path surfaces, where work is hard to observe and slower
than it needs to be. They are grouped because they share that surface and a
single implementer can land them coherently.

- **Worker observability** (`BL-WORKER-OBSERVABILITY`): there is no BullMQ
  instrumentation and no W3C `traceparent` / `correlationId` injected into job
  data, so a tRPC->Prisma trace ends at `queue.add` and the worker runs as a
  parentless root span. Worker failures hand-build JSON to `process.stderr`,
  bypassing `AppLogger`, so they carry no `correlationId` / `traceId` and never
  reach OTLP/Loki or the file sink. The PDF happy path has no per-step timing
  and `page.goto` has no explicit timeout.
- **DLQ / queue monitoring** (`BL-DLQ-MONITORING`): a non-numeric
  `DLQ_ALERT_THRESHOLD` becomes `NaN` and silently disables the alert.
  `telegram-outbound` is absent from `QUEUE_NAMES`, so its terminal failures
  never count toward `cr_dlq_failed_total` or the threshold, and
  `telegramMessageSentTotal` is only ever incremented with `status="ok"`. Bull
  Board creates two `Queue` instances outside DI that are never closed, leaking
  a Redis connection on shutdown.
- **Hot-path query performance** (`BL-PERF-QUERIES`): `getWeeklyReport` awaits
  `leadUsers` then projects sequentially though they are independent; archive
  listing fetches the entire archive with the full nested section graph and
  paginates in memory; `upsertUsers` issues `O(3N)` sequential count+delete per
  removed user; `organization.getOrganization` upserts on every read
  (write-on-read on the anonymous landing path); the logger runs
  `readdir`+`stat` per log line.

Source: `docs/repo-excellence-review-2026-06-28.data.json` backlog items
`BL-WORKER-OBSERVABILITY`, `BL-DLQ-MONITORING`, `BL-PERF-QUERIES` (all P2).

## What Changes

Worker observability (extends `error-trace-correlation`):

- Inject the active W3C `traceparent` and `correlationId` into job data at
  every `queue.add` (pdf-export, email-reminder, telegram-outbound).
- In each worker processor, extract that context, start a span linked to the
  enqueue trace, and seed a `nestjs-cls` scope so `correlationId` is restored
  for the whole job run.
- Route all worker logging through `AppLogger` instead of hand-built JSON to
  `process.stderr`, so worker logs carry `correlationId` / `traceId` and reach
  OTLP/Loki and the file sink.
- Add per-step duration logs to the PDF export path and an explicit timeout on
  `page.goto`.

DLQ / queue monitoring (new `queue-reliability-monitoring`):

- Validate `DLQ_ALERT_THRESHOLD` with a `Number.isFinite` fallback to the
  default and a warn log when the env value is unparseable.
- Add `telegram-outbound` to the monitored `QUEUE_NAMES` so the existing DLQ
  monitor's `QueueEvents` listener increments
  `cr_dlq_failed_total{queue="telegram-outbound"}` once per terminal failure and
  the threshold poll covers it; do not add a second worker-handler increment.
- Manage the lifecycle of the two Bull Board `Queue` instances so they close
  on application shutdown and do not leak a Redis connection.

Hot-path query performance (new `hot-path-query-performance`):

- `Promise.all` the independent `leadUsers` and `projects` queries in
  `getWeeklyReport`.
- Move archive-listing pagination into the repository using the existing
  `reportId` cursor / `nextCursor` contract with stable `publishedAt desc, id`
  ordering, and load the heavy nested section graph only for snapshot-less
  fallback rows.
- Replace the per-user count+delete loop in `upsertUsers` with a bulk prefetch
  plus a single `deleteMany`.
- Read the organization with `findUnique`, falling back to `upsert` only when
  the row is absent, so the anonymous landing path no longer writes on read.
- Prune the log directory only after an actual rotation or on a timer, not on
  every log line.

## Capabilities

### New Capabilities

- `queue-reliability-monitoring`: BullMQ DLQ alerting MUST survive a misconfigured
  threshold, MUST account for every terminal-failing queue including
  `telegram-outbound`, and MUST close all queue handles on shutdown.
- `hot-path-query-performance`: hot-path reads MUST parallelize independent
  queries, paginate at the database, bulk-write user reconciliation, avoid
  write-on-read for the organization, and avoid per-log-line filesystem work.

### Modified Capabilities

- `error-trace-correlation`: trace context and `correlationId` MUST cross the
  BullMQ enqueue->worker boundary, and worker logs MUST flow through `AppLogger`
  so they carry trace/correlation context like in-request logs do.

## Impact

- `apps/api/src/infrastructure/otel/otel.bootstrap.ts`
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`
- `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`
- `apps/api/src/infrastructure/bullmq/bull-board.module.ts`
- `apps/api/src/modules/telegram/telegram.queue.ts`
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`
- `apps/api/src/modules/archive/archive.service.ts`
- `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`
- `apps/api/src/modules/organization/organization.prisma-repository.ts`
- `apps/api/src/lib/logger.ts`
- Telemetry consumers of `cr_dlq_failed_total` (new `telegram-outbound` label).
- No schema change; no migration; no shared-contract change (MVP phase).

## Non-goals

- Activating the telegram feature itself (Phase 55); this change only makes its
  queue observable when it does run.
- Adding a generic OpenTelemetry BullMQ auto-instrumentation package if manual
  span linking is sufficient; the requirement is the linked span, not a specific
  library.
- Caching organization reads or report queries beyond removing write-on-read and
  sequential awaits.
- Reworking the Bull Board UI or its authorization (tracked elsewhere).
