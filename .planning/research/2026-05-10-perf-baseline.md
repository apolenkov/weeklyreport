# Perf Baseline — 2026-05-10

Snapshot from local docker stack after Phase 44 wave 1-2 land.
Data size: 9 users, 1 group, 8 periods, 0 projects, ~12 reminder rows.

## API latency (30-min window)

```
procedure                                count   p50   p95   max
-----------------------------------------------------------------
admin.snapshot                             29     7    52    57
admin.getSettings                          23    15    54    80
dev.listUsers                              20    13    54    54
admin.dlqCount                             21     7    30    35
admin.pendingReopenCount                   23     7    33    33
auth.me                                    42     1    13    16
```

Acceptable at current data size. Will not stay acceptable at 10K reports.

## Postgres hot tables

```
relname            seq_scan   seq_tup_read   idx_scan
User                   1661          15522       455
ReportSection           793           6269      1353
Project                 593           5329       604
ReportingGroup          706           1515       124
Report                  524           1297       459
```

User table read 15K rows total over 30 min from 9-row dataset — typical N+1 on snapshot fetch + per-request `auth.me` user lookup. Index hit ratio fine for the small dataset.

## What already exists

- FTS: `searchTsv` columns + GIN indexes on `Item`, `Project`, `Decision`,
  `ReportSection` with `plainto_tsquery('russian', ...)` and `ts_headline`
  in `search.prisma-repository.ts`. Russian stemmer wired.
- Redis cache: `analytics.cache.ts` wraps Redis with `getOrCompute(key, fn)`.
  Used by `trafficLightHistory`, `leadVelocity`, `periodComparison`.
- All FK indexes from Prisma schema.
- ReminderPolicy: `@@index([kind, active])`, `@@index([active])`,
  `@@index([validFrom, validUntil])` after wave 1+1.5.

## Gaps — proposed Phase 47 "Perf pass"

### P0 — Cache wins (high blast radius)

1. **`admin.snapshot` cache.** Currently 7 parallel `findMany` on every admin
   page open / tab switch. Add Redis cache key `admin:snapshot:v1` with 10s
   TTL. Invalidate from every `admin.save*` / `admin.remove*` / `admin.archive*`
   mutation. Estimate: −85% admin DB load.
2. **`admin.dlqCount` + `admin.pendingReopenCount`.** Both polled by the
   admin tabs every few seconds. 30s Redis TTL + bust on relevant mutations.

### P1 — Schema indexes (low cost, future-proof)

1. **`Report (status, periodStart DESC)`** compound — archive list filters
   `status='published'` and orders by `periodStart` desc. Today seq-scans
   the 0-row table; fine. At 200+ reports will start scanning.
2. **`ReminderRule (status, fireAt)`** compound — scheduler queries
   `status='active' AND fireAt <= now()`. Two single-column indexes today,
   composite is strictly better.
3. **`User (role, reportingGroupId)`** compound — group-scope filter (UFB-040)
   always combines these two. Today FK index only.

### P2 — Observability before deeper tuning

1. **Enable `pg_stat_statements`** in `docker-compose.yml` postgres command
   (`shared_preload_libraries=pg_stat_statements`, `pg_stat_statements.track=all`).
   Gives a real slow-query log keyed by normalized SQL fingerprint.
2. **Prisma `log: ['query']` already wired** but unfiltered — pipe to
   Grafana / Loki for offline review (postgres-exporter already in compose).

### P3 — Things explicitly NOT to do now

- Delete "unused" indexes — most are unused because the dataset is small or
  the feature path has not been exercised yet (e.g. `Project_searchTsv_idx`
  is unused because no one searched in this session, not because search is
  broken).
- Add another full-text search target — current four GIN indexes cover the
  cross-content search router; extending to `AuditEvent` / `NotificationLog`
  is a future need, not a current pain.
- Switch to `pgbouncer transaction mode` — single instance, 20 connections,
  not yet a bottleneck.

## Trigger to act on this

When any of:

- weekly active users > 30, OR
- reports table > 200 rows, OR
- admin tab visibly lags > 1s open time, OR
- a real user complains about a specific query.

Right now none of these hold. Defer P0-P2 to **Phase 47 "Perf pass"**
after Phase 44 + 45 land and the dataset grows past synthetic seed size.
