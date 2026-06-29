## Context

This change groups three independent P2 findings that all live on the API's
asynchronous and hot-path surfaces. They are bundled so one implementer can land
the queue/observability/perf work coherently, but each maps to its own
capability and can be reviewed in isolation. No schema or shared-contract change
is involved (MVP phase).

## Why group these three

- They touch overlapping files under `apps/api/src/infrastructure/bullmq` and the
  metrics registry, so splitting them would cause churn and merge friction.
- They share one theme: the API does asynchronous and repeated work that is
  under-observed (worker traces/logs, DLQ counters) or under-optimized
  (sequential/in-memory/write-on-read queries).
- Each is small on its own; grouping keeps the backlog readable without coupling
  unrelated risk.

## Worker trace + correlation propagation

Decision: inject context manually into job data rather than depend solely on a
BullMQ auto-instrumentation package.

- At `queue.add`, read the active `traceparent` (W3C) and the CLS
  `correlationId` and place them on the job payload.
- In the processor, extract that context, start a span linked to the enqueue
  trace, and run the body inside a `nestjs-cls` scope seeded with the
  `correlationId`, mirroring how in-request logs already resolve it
  (`apps/api/src/lib/logger.ts`).
- Why manual: the existing OTel bootstrap wires only Express/Http
  instrumentation; a linked span plus a seeded CLS scope is the minimal, testable
  unit and does not hinge on a specific instrumentation library version. An
  auto-instrumentation package MAY be added if it cleanly produces the same
  linked span, but it is not required by the contract.

Consistency note: the existing `error-trace-correlation` requirement "An error
with no active span is still reported" lists "in a background job" as an example
of a span-less capture. The new worker requirements are scoped to the
instrumented processors and explicitly leave genuinely span-less captures (boot,
context loss, uninstrumented paths) to that existing requirement, so the two do
not contradict. The new requirements are ADDED (not MODIFIED), so no
exact-header restatement of the old requirement is needed.

## DLQ / queue monitoring

- Threshold parsing: `Number(env)` then `Number.isFinite` guard with a fallback
  to the documented default (5) and a warn log naming the bad value. Keeps the
  alert live under misconfiguration.
- Telegram queue: add `telegram-outbound` to `QUEUE_NAMES`
  (`dlq-monitor.service.ts`). The DLQ monitor already increments
  `cr_dlq_failed_total{queue}` exactly once per terminal failure via its
  per-queue `QueueEvents` listener, and `checkThresholds` iterates the same
  `QUEUE_NAMES`-derived queue map — so a single `QUEUE_NAMES` entry both counts
  telegram terminal failures and makes them eligible for the alert. Do NOT also
  increment from a telegram worker handler; that would double-count terminal
  failures. Telegram is a Phase 55 deferred feature, so the `QUEUE_NAMES` entry
  (the new activation point) carries a `TODO(Phase 55)` per the deferred-feature
  convention; the metric label is declared up front so observability is ready
  when the feature turns on.
- Bull Board lifecycle: the two `Queue` instances must be owned by a
  lifecycle-aware holder (DI provider or module `onModuleDestroy`) so they
  `close()` on shutdown and release their Redis connection.

## Hot-path performance

Each item is a local, behavior-preserving optimization:

- `Promise.all([leadUsers, projects])` in `getWeeklyReport`.
- Archive listing: push pagination into the repository using the existing
  `reportId` cursor (`Prisma cursor: { id }` + `skip: 1`) with stable
  `orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }]`. Fetch `take: limit + 1`
  so the repo can tell whether a next page exists without re-reading the whole
  archive: keep the first `limit` rows as the page, and if the `(limit + 1)`th
  probe row came back, emit the last kept row's `reportId` as `nextCursor` (else
  `null`, which also covers the final/empty page and a stale cursor). Load the
  nested section graph only for snapshot-less fallback rows (split the query, or
  select the graph lazily).
- `upsertUsers`: prefetch the removed set in one query, then one `deleteMany`.
- Organization read: `findUnique`, fall back to create only when absent — removes
  the write lock on the anonymous landing path.
- Logger: gate the `readdir`+`stat` prune behind a rotation event or a timer
  instead of running it per emitted line.

## Risks / trade-offs

- Telegram metric is dormant until Phase 55; the `TODO(Phase 55)` trace prevents
  it from reading as a live-but-broken path.
- Archive section-graph splitting must preserve current list output shape; cover
  with a test that asserts snapshot rows and fallback rows render identically to
  today.
- Organization `findUnique` fallback must still create the row exactly once on a
  cold database; cover the absent-row path with a test.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` green.
- Unit tests: threshold-fallback warn path; telegram failed-handler increments
  `cr_dlq_failed_total` exactly once; Bull Board queues closed on shutdown;
  `getWeeklyReport` dispatches both queries concurrently; archive cursor
  pagination reads only the page and resumes from the `reportId` cursor;
  `upsertUsers` issues one `deleteMany`; organization read performs no write when
  the row exists; logger does not prune per line.
- (Markdownlint is removed in this repo — do not run `pnpm lint:md`.)
