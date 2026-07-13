## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`docker-compose.prod.yml` sets Redis to `--maxmemory-policy noeviction` but
never sets `--maxmemory`, so the policy is inert while the container carries
a hard 256M cgroup limit (`deploy.resources.limits.memory`). The
`pdf-export` and `email-reminder` BullMQ queues (`bullmq.module.ts`) are
registered with no `defaultJobOptions`, so their completed and failed job
hashes accumulate in Redis forever and are persisted by AOF — only the
`telegram-outbound` queue bounds retention today
(`telegram.queue.ts:57-58`). As RSS climbs unbounded toward the 256M cgroup
ceiling, the kernel eventually OOM-kills `redis-server`, and the AOF replay
on restart can crash-loop the container. Nothing today alerts on Redis
memory usage before that point — `/health/ready`
(`bullmq.health.ts`) only detects a Redis that is already dead.

The fix is bounded retention plus a Redis-level memory cap, not an eviction
policy change: BullMQ requires `noeviction` for queue-state correctness
(evicting an in-flight job hash under `allkeys-lru`/`volatile-lru` would
silently corrupt queue state, which is worse than the outage it would be
meant to prevent).

## What Changes

- `docker-compose.prod.yml`: add `--maxmemory 200mb` to the Redis
  `command` array, keeping `--maxmemory-policy noeviction` unchanged. 200M
  sits below the existing 256M cgroup limit, leaving headroom for
  Redis's own overhead so the process hits its own cap before the kernel
  kills it.
- `apps/api/src/infrastructure/bullmq/bullmq.module.ts`: add
  `defaultJobOptions: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } }`
  to the `pdf-export` and `email-reminder` `BullModule.registerQueue(...)`
  calls, matching the retention `telegram.queue.ts` already sets per-job for
  `telegram-outbound`.
- `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`: extend the
  existing poll loop to also read Redis `INFO memory` (`used_memory`) once
  per interval and emit a structured warn log plus a Prometheus gauge when
  usage crosses 80% of the configured Redis memory cap, so an operator sees
  the slow climb before the process is killed.
- `apps/api/src/infrastructure/metrics/metrics.registry.ts`: add a
  `redisMemoryUsedBytes` gauge alongside the existing `dlqFailedTotal`
  counter.
- `apps/api/src/infrastructure/config/env.schema.ts`: add a required
  `REDIS_MAXMEMORY_BYTES` field (no default) so the alert threshold is
  computed from the same cap operators configure in
  `docker-compose.prod.yml`, instead of a hardcoded literal drifting from
  the deploy config.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `queue-reliability-monitoring`: adds bounded job retention for
  `pdf-export`/`email-reminder` and Redis memory-usage alerting alongside
  the existing DLQ failed-job monitoring.

## Impact

- `docker-compose.prod.yml`
- `apps/api/src/infrastructure/bullmq/bullmq.module.ts`
- `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`
- `apps/api/src/infrastructure/metrics/metrics.registry.ts`
- `apps/api/src/infrastructure/config/env.schema.ts`

Non-goals: no change to `--maxmemory-policy` (stays `noeviction`); no
change to the `telegram-outbound` queue, which already bounds retention; no
new reaper for stalled/active jobs — BullMQ's built-in `stalledInterval`
already reclaims those, and this change's scope is bounded retention plus
memory visibility, not a new job-lifecycle mechanism.
