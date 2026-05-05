# Phase 37, Plan 02 — SUMMARY

**REQ-IDs:** OBS-02
**Status:** complete

## What shipped

- `apps/api/src/infrastructure/metrics/metrics.registry.ts` (NEW) — single shared `Registry` + `collectDefaultMetrics()` (Node.js heap/CPU/GC) + three custom counters:
  - `cr_dlq_failed_total{queue}` — incremented when a BullMQ job exhausts its retry budget
  - `cr_rate_limit_hits_total{bucket}` — incremented per 429 response (bucket = `auth` | `trpc`)
  - `cr_login_attempts_total{method, outcome}` — incremented at SAML callback + dev-login (method = `saml` | `dev-login`, outcome = `success` | `fail`)
- `apps/api/src/infrastructure/metrics/metrics.controller.ts` — now imports from the registry instead of calling `collectDefaultMetrics()` itself (removes the duplicate-register risk that prom-client throws on under hot-reload).
- `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts` (NEW) — Injectable `OnModuleInit` / `OnModuleDestroy`. Opens a `QueueEvents` subscription per known queue (`email-reminder`, `pdf-export`) using the shared Redis connection. On `failed`, loads the job, checks `attemptsMade >= opts.attempts`, and only counts terminal failures (so retries don't inflate). Sets up a 60s `setInterval` poll that calls `queue.getFailedCount()` for each queue and emits a structured ERROR log when the absolute count exceeds `DLQ_ALERT_THRESHOLD` (env, default 5). The interval is `unref()`-ed so it doesn't block shutdown.
- `apps/api/src/infrastructure/bullmq/bullmq.module.ts` — adds `DLQMonitorService` to providers.
- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` — handler now increments `cr_rate_limit_hits_total{bucket}` alongside the existing warn-log.
- `apps/api/src/modules/auth/auth.routes.ts` — increments `cr_login_attempts_total` at four points (SAML callback success, SAML callback fail, dev-login success, dev-login fail incl. invalid-role early-return).
- `apps/api/src/infrastructure/metrics/metrics.registry.test.ts` (NEW) — 4 unit tests verifying counter exposure, label separation, multi-outcome login counting, and presence of Node.js default metrics.

## Verification

```bash
pnpm --filter @customreport/api test src/infrastructure/metrics/metrics.registry.test.ts
# 4/4 green
pnpm --filter @customreport/api test
# 602/602 green (was 598/598 before; +4 new tests)
pnpm --filter @customreport/api typecheck
# clean
```

## Manual smoke (deferred — needs api running)

```bash
# Hit /metrics, look for the three new counter families
curl -s http://localhost:3001/metrics | grep '^cr_'

# Trigger rate-limit via repeated logins → cr_rate_limit_hits_total{bucket="auth"} climbs
for _ in {1..10}; do curl -s http://localhost:3001/auth/dev-login >/dev/null; done

# Manually push a job that always fails → cr_dlq_failed_total{queue=...} climbs
# (covered by integration paths in CI; not automated here)
```

## Why no Prometheus AlertManager rule was added

Per the OBS-02 contract, the alert rule is a Prometheus-side concern (alertmanager). The api side only owns the signals (counter + threshold ERROR log). The alert wiring belongs in `deploy/prometheus.yml` rules and is an ops-side step.

## Files

- `apps/api/src/infrastructure/metrics/metrics.registry.ts` (new)
- `apps/api/src/infrastructure/metrics/metrics.registry.test.ts` (new)
- `apps/api/src/infrastructure/metrics/metrics.controller.ts` (rewired to shared registry)
- `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts` (new)
- `apps/api/src/infrastructure/bullmq/bullmq.module.ts` (provider added)
- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` (counter call)
- `apps/api/src/modules/auth/auth.routes.ts` (counter calls at 4 points)
