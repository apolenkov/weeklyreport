---
phase: 47
plan: 47-03
subsystem: api, obs
tags: [prom-client, prometheus, grafana, trpc, latency, dx-03]
requires: [phase-37-prom-grafana-bootstrap]
provides: [trpc-latency-histograms, grafana-trpc-dashboard]
affects:
  - apps/api/src/infrastructure/metrics/
  - apps/api/src/infrastructure/trpc/trpc.middleware.ts
  - deploy/grafana/
  - docker-compose.observability.yml
key-files:
  created:
    - apps/api/src/infrastructure/metrics/trpc-metrics.middleware.ts
    - apps/api/src/infrastructure/metrics/trpc-metrics.middleware.test.ts
    - deploy/grafana/trpc-latency-dashboard.json
  modified:
    - apps/api/src/infrastructure/metrics/metrics.registry.ts
    - apps/api/src/infrastructure/trpc/trpc.middleware.ts
    - docker-compose.observability.yml
    - .planning/phases/47-developer-experience/deferred-items.md
  acknowledged-existing:
    - apps/api/src/infrastructure/metrics/metrics.controller.ts
    - apps/api/src/infrastructure/metrics/metrics.module.ts
    - deploy/prometheus.yml
    - deploy/grafana/customreport-dashboard.json
decisions:
  - Reused Phase 37 metricsRegistry (single Registry, single collectDefaultMetrics)
  - Skipped scrape-config edit — Phase 37 prometheus.yml already targets customreport-api:3002
  - Wired metricsMiddleware before loggingMiddleware on every procedure helper
  - Kept middleware framework-agnostic (no initTRPC dep) for cheap unit testing
metrics:
  duration: ~25 min
  completed: 2026-05-10
  task_count: 12
  files_created: 3
  files_modified: 4
---

# Phase 47 Plan 03: tRPC Prometheus Histograms + Grafana Dashboard Summary

**One-liner:** prom-client histogram + counter on every tRPC procedure
with `{procedure, type, status}` labels; metrics middleware ordered before
logger so timings exclude logger overhead; new Grafana dashboard
`trpc-latency` with p50/p95/p99 + error rate + top-10 slow + request
volume panels.

## What Was Built

### `apps/api/src/infrastructure/metrics/trpc-metrics.middleware.ts`

Framework-agnostic middleware function that:

1. Starts a `trpcRequestDurationSeconds` timer with `{procedure, type}`.
2. Awaits `next()`.
3. Resolves `status` from `result.ok` (`success` | `error`).
4. Records the timer with `status`, increments `trpcRequestTotal` with
   the same label set.
5. On a raw thrown exception (defense-in-depth — tRPC normally converts
   throws to `result.ok=false`), records `status="error"` and rethrows.

Generic over the `next()` return type so tRPC's branded `marker` field
survives untouched through the pass-through — keeps the
`t.middleware(...)` wrapper type-clean without `as` casts.

### `apps/api/src/infrastructure/trpc/trpc.middleware.ts`

Added `metricsMiddleware` (thin `t.middleware(...)` wrapper delegating to
the framework-agnostic function) and wired it as the FIRST middleware on
all six procedure helpers (`publicProcedure`, `protectedProcedure`,
`headProcedure`, `leadProcedure`, `viewerProcedure`, `anyRoleProcedure`,
`adminProcedure`) — before `loggingMiddleware`. Result: histogram
captures pure procedure work, excluding logger + audit + Prisma
userActionLog overhead.

### `apps/api/src/infrastructure/metrics/metrics.registry.ts`

Appended two new singletons to the existing Phase 37 registry:

- `trpcRequestDurationSeconds` — `Histogram`, buckets
  `[0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`,
  labels `{procedure, type, status}`.
- `trpcRequestTotal` — `Counter`, same label set.

Reused the same `metricsRegistry` instance so `collectDefaultMetrics()`
is called exactly once and `/metrics` continues to expose Node.js heap /
CPU / GC counters from Phase 37 alongside the new tRPC series.

### `deploy/grafana/trpc-latency-dashboard.json`

Grafana dashboard `uid: trpc-latency`, 4 panels:

| Panel                                       | Query                                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| 1. p50/p95/p99 latency by procedure (top 5) | `topk(5, histogram_quantile(0.50                                                                                                                         | 0.95 | 0.99, sum by (le, procedure) (rate(trpc_request_duration_seconds_bucket{job="customreport-api"}[5m]))))` |
| 2. Error rate stat                          | `sum(rate(trpc_request_total{status="error",procedure!~"auth\\..*"}[5m])) / clamp_min(sum(rate(trpc_request_total{procedure!~"auth\\..*"}[5m])), 0.001)` |
| 3. Top-10 slowest (bargauge, p95)           | `topk(10, histogram_quantile(0.95, sum by (le, procedure) (rate(trpc_request_duration_seconds_bucket{job="customreport-api"}[5m]))))`                    |
| 4. Request volume by procedure              | `sum by (procedure) (rate(trpc_request_total{job="customreport-api"}[1m]))`                                                                              |

Visual style matches the existing `customreport-dashboard.json` (Phase 37) — same schemaVersion 39, Prometheus datasource, browser timezone,
30s refresh.

Error-rate panel excludes `auth.*` because cold-load `auth.me` calls
before any session exists return `UNAUTHORIZED` and would dominate the
ratio (false-positive at every page load).

### `docker-compose.observability.yml`

Added one bind-mount line putting the new dashboard JSON into the
provisioning folder alongside `customreport-dashboard.json`. Grafana
provisioning at `deploy/grafana/provisioning/dashboards/customreport.yml`
auto-loads anything in that folder on container start.

## Metric Series Emitted

```
# Histogram (per (procedure, type, status) combination)
trpc_request_duration_seconds_bucket{procedure, type, status, le}
trpc_request_duration_seconds_sum{procedure, type, status}
trpc_request_duration_seconds_count{procedure, type, status}

# Counter
trpc_request_total{procedure, type, status}
```

Existing Phase 37 series unchanged:
`http_request_duration_seconds_*`, `cr_dlq_failed_total`,
`cr_rate_limit_hits_total`, `cr_login_attempts_total`,
`nodejs_*`, `process_*`.

## Smoke-Test Evidence

```bash
$ pnpm --filter @customreport/api list prom-client
prom-client 15.1.3

$ curl -sf http://localhost:3002/health/live
{"status":"ok",...}

$ curl -s http://localhost:3002/metrics | head -3
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 1.144731

$ for i in $(seq 1 10); do curl -s 'http://localhost:3002/trpc/auth.me?input=' >/dev/null; done
$ for i in $(seq 1 3); do curl -s 'http://localhost:3002/trpc/admin.snapshot' >/dev/null; done
$ curl -s http://localhost:3002/metrics | grep -E '^trpc_request_(total|duration_seconds_count)' | head -4
trpc_request_duration_seconds_count{procedure="auth.me",type="query",status="success"} 10
trpc_request_duration_seconds_count{procedure="admin.snapshot",type="query",status="error"} 3
trpc_request_total{procedure="auth.me",type="query",status="success"} 10
trpc_request_total{procedure="admin.snapshot",type="query",status="error"} 3

$ curl -s 'http://localhost:9090/api/v1/targets?state=active' | jq '.data.activeTargets[] | {job:.labels.job, health, url:.scrapeUrl}'
{"job":"customreport-api","health":"up","url":"http://api:3002/metrics"}

$ curl -s -u admin:admin 'http://localhost:3003/api/search?type=dash-db' | jq '.[].title'
"CustomReport — Operational Dashboard (skeleton)"
"CustomReport — tRPC Latency (DX-03)"
```

## Acceptance Criteria Verification

| Criterion                                                                         | Status              | Evidence                                                           |
| --------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| `apps/api/src/infrastructure/metrics/` has middleware + controller + module       | DONE                | controller + module pre-existed from Phase 37; middleware new      |
| `prom-client` installed as direct dep                                             | DONE                | `15.1.3` listed in api package.json                                |
| `/metrics` returns Prometheus text format                                         | DONE                | live smoke shows `# HELP process_cpu_user_seconds_total ...`       |
| `trpc_request_duration_seconds_{bucket,sum,count}` + `trpc_request_total` present | DONE                | live smoke (10 success, 3 error series visible)                    |
| Metrics middleware before logger                                                  | DONE                | `metricsMiddleware` first on every helper; logger second           |
| Prometheus scrape job for api                                                     | DONE (pre-existing) | Phase 37 `deploy/prometheus.yml` job `customreport-api` UP         |
| Grafana dashboard `trpc-latency.json` with 4 panels                               | DONE                | `deploy/grafana/trpc-latency-dashboard.json` mounted + auto-loaded |
| Smoke: hit procedure 10 times → counter ≥ 10                                      | DONE                | `auth.me` × 10 → `trpc_request_total{...} 10`                      |
| Existing tests green                                                              | DONE                | 714/714 api tests pass                                             |
| One new unit test for middleware labels                                           | DONE                | `trpc-metrics.middleware.test.ts` (4 tests, all pass)              |

## Tests

- `apps/api/src/infrastructure/metrics/trpc-metrics.middleware.test.ts` — 4 tests:
  1. Success label on passing query (counter=2, histogram count=2)
  2. Error label on `TRPCError` return (`status="error"`)
  3. Error label + rethrow when `next()` throws
  4. Histogram timer fires and bucket bounds valid; singleton handles
- All 9 metrics tests pass (5 existing + 4 new)
- Full api suite: 714/714 pass
- ESLint + tsc strict: clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type Error] Generic-ified middleware return type**

- **Found during:** ESLint step (`pnpm lint` runs `tsc --noEmit -p tsconfig.json`)
- **Issue:** my `MiddlewareResult` union with `marker?: unknown` was not
  assignable to tRPC's `MiddlewareResult<unknown>` whose `marker` is
  branded as `"middlewareMarker" & { __brand: ... }`.
- **Fix:** parametrised `trpcMetricsMiddleware<R extends TrpcMiddlewareResult>`
  to pass `next()`'s exact return type through untouched, including the
  branded marker.
- **Files modified:** `apps/api/src/infrastructure/metrics/trpc-metrics.middleware.ts`
- **Commit:** included in single 47-03 commit

### Plan-vs-Reality Adjustments (not deviations)

1. **Plan step 2 (install prom-client):** skipped — Phase 37 already
   added it as a direct dep (`apps/api/package.json` line 50).
2. **Plan step 4 (create `metrics.controller.ts`):** skipped — Phase 37
   already created it (`@Controller("metrics")` returning
   `metricsRegistry.contentType` + `metricsRegistry.metrics()`).
3. **Plan step 5 (wire MetricsController):** skipped — already wired
   into `apps/api/src/app.module.ts` at line 50.
4. **Plan step 7 (`collectDefaultMetrics()`):** skipped — Phase 37 calls
   it at module-load time in `metrics.registry.ts` line 21.
5. **Plan step 8 (add scrape job):** skipped — Phase 37
   `deploy/prometheus.yml` already has `customreport-api` job at
   `api:3002`. Verified UP in live Prometheus.
6. **Plan signature `createTrpcMetricsMiddleware(t)` factory:** rejected.
   Used a framework-agnostic function `trpcMetricsMiddleware(opts)`
   wrapped by a one-line `t.middleware(...)` adapter at the call site.
   Cheaper unit-testable; the factory shape added no value because all
   trpc procedure helpers live in one file.
7. **Plan note "Restart api + prometheus + grafana":** grafana must use
   `up -d --force-recreate` (not `restart`) because `restart` does not
   re-read compose volumes. Documented inline in the smoke-test log.

## Deferred Issues

### Pre-existing api container dev-bootstrap (luxon)

See `deferred-items.md` "Re-confirmed during 47-03 live `/metrics`
smoke-test". Required `pnpm install` on the host before the api
container could re-resolve the workspace `node_modules` for luxon.
Re-encountered during 47-03 but **not caused by 47-03** — `apps/api/src/
modules/reminders/policy-applicator.service.ts` (Phase 44-02) is the
luxon importer. Host-side `yes | pnpm install` cleared the symlink lag
and api came up clean.

## Threat Flags

None. Surfaces touched:

- `/metrics` — already exposed on the api container (Phase 37). Reachable
  only inside the docker network at `api:3002`. No new external surface.
- tRPC procedure helpers — middleware added is observation-only (label
  emit) with no input/output inspection beyond the procedure path. No
  PII or user data in labels.
- Grafana dashboard — read-only Prometheus queries. No mutation surface.

## Self-Check: PASSED

Files created (verified):

- `/Users/ap/work/customreport/apps/api/src/infrastructure/metrics/trpc-metrics.middleware.ts` — FOUND
- `/Users/ap/work/customreport/apps/api/src/infrastructure/metrics/trpc-metrics.middleware.test.ts` — FOUND
- `/Users/ap/work/customreport/deploy/grafana/trpc-latency-dashboard.json` — FOUND

Live smoke-test artifacts:

- `/metrics` HTTP 200, prom text format
- `trpc_request_total{procedure="auth.me",type="query",status="success"} 10` — FOUND
- `trpc_request_total{procedure="admin.snapshot",type="query",status="error"} 3` — FOUND
- Prometheus target `customreport-api` health=up
- Grafana dashboard uid `trpc-latency` returned by `/api/search`
