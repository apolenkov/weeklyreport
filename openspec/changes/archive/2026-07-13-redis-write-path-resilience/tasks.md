## 1. Cap Redis memory below the cgroup limit

- [ ] 1.1 `docker-compose.prod.yml`: add `--maxmemory`, `200mb` to the Redis
      `command` array, right after the existing `--maxmemory-policy`,
      `noeviction` pair. Do not change the policy value.
- [ ] 1.2 Confirm `deploy.resources.limits.memory: 256M` is unchanged — the
      200M Redis cap must stay below it, leaving headroom for Redis's own
      process overhead.

## 2. Bound job retention for pdf-export and email-reminder

- [ ] 2.1 `apps/api/src/infrastructure/bullmq/bullmq.module.ts`: add
      `defaultJobOptions: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } }`
      to the `BullModule.registerQueue({ name: "pdf-export" })` call
- [ ] 2.2 Add the same `defaultJobOptions` to
      `BullModule.registerQueue({ name: "email-reminder" })`
- [ ] 2.3 Leave `telegram-outbound`'s registration and
      `TELEGRAM_OUTBOUND_JOB_OPTS` untouched — it already sets equivalent
      retention per-job

## 3. Add Redis memory-usage alerting

- [ ] 3.1 `apps/api/src/infrastructure/config/env.schema.ts`: add
      `REDIS_MAXMEMORY_BYTES: z.coerce.number().int().positive()` as a
      REQUIRED field (no `.default()`), documented as matching the
      `--maxmemory` value configured in `docker-compose.prod.yml`
- [ ] 3.2 Set `REDIS_MAXMEMORY_BYTES=209715200` (200mb in bytes) in every
      env file/example that ships `REDIS_HOST`/`REDIS_PORT` today, so boot
      does not fail loud on a missing var
- [ ] 3.3 `apps/api/src/infrastructure/metrics/metrics.registry.ts`: add a
      `redisMemoryUsedBytes` `Gauge` registered on `metricsRegistry`,
      alongside the existing `dlqFailedTotal` counter
- [ ] 3.4 `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`:
      inside the existing `POLL_INTERVAL_MS` timer callback, read
      `used_memory` from the shared Redis connection's `INFO memory`
      response once per interval, set `redisMemoryUsedBytes`, and emit a
      structured warn log the first time usage in that interval crosses
      80% of `env.REDIS_MAXMEMORY_BYTES`
- [ ] 3.5 Reuse the existing `QueueRegistry`-owned connection for the
      `INFO` call rather than opening a new Redis client

## 4. Spec delta

- [ ] 4.1 `queue-reliability-monitoring`: ADD a requirement that
      `pdf-export` and `email-reminder` jobs carry bounded retention
- [ ] 4.2 `queue-reliability-monitoring`: ADD a requirement that Redis
      memory usage is monitored and alerted on before the configured cap is
      reached

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 Live check: enqueue and complete several pdf-export/email-reminder
      jobs, confirm completed/failed hash counts in Redis stay bounded at
      the configured `count` instead of growing unbounded
- [ ] 5.4 Fail-injection check: temporarily lower `REDIS_MAXMEMORY_BYTES`
      below current `used_memory` and confirm the warn log and
      `redisMemoryUsedBytes` gauge both fire within one poll interval
- [ ] 5.5 `openspec validate redis-write-path-resilience --strict`
- [ ] 5.6 Adversarial review of the diff before archiving
