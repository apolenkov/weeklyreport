# Performance Audit — Phase 39-03 (2026-05-06)

**Methodology:** real production-shape signal from `apps/api/.logs/api.log`
(12MB, ~9.3K tRPC calls captured during 2026-05-04..05 dev usage) + slow-
query log emitted by `PrismaService` at `>=100ms` threshold. NOT theoretical
guesses — every index added below is justified by observed traffic patterns
or by an entry in the slow-query log.

---

## 1. Top tRPC procedures by call count (real frequency)

```
   976  auth.me                       ← 10.5% of total
   402  weeklyReport.get              ← lead-form initial load
   375  admin.dlqCount                ← admin polling (every ~5s)
   177  admin.snapshot                ← admin polling
   176  admin.getSettings             ← admin polling
   113  reports.myHistory             ← lead history page
   108  reports.getActive             ← lead-form active period
    96  leadForm.versions             ← version snapshots panel
    96  leadForm.byPeriod             ← head/admin period view
    83  archive.list                  ← reports archive
    78  admin.pendingReopenCount      ← admin polling
```

`auth.me` returns `ctx.session` directly (no DB hit) — the high count is a
React-Query refetch pattern from the frontend, not a DB load. Already
optimal at the api layer.

The top 4 admin procedures (`dlqCount` + `snapshot` + `getSettings` +
`pendingReopenCount`) sum to **806 calls** = 8.7% of total, all polling.
These are the prime caching candidates.

## 2. Top procedures by avg latency (excluding dev fixture)

```
proc                       calls   avg_ms   max_ms
admin.saveUser                4      82       98
admin.deleteUser              1      73       73
reminders.dispatchPending     6      44       79
reports.saveDraft             5      43       46
leadForm.restoreVersion       3      38       40
leadForm.fillFrom             4      33       48
weeklyReport.get            402      27      214
reports.getActive           108      20      261   ← spike
admin.getSettings           176      17      126
leadForm.byPeriod            96      14      139
admin.snapshot              177      13      130
```

`weeklyReport.get` averages 27ms but has a 214ms tail; `reports.getActive`
261ms tail — both potential N+1 candidates. Investigated: both use Prisma
`include` for nested relations correctly (single round-trip) — the tail is
likely the cold-cache first hit after the postgres container boots, since
the slow-query log captures these exact SELECTs at startup.

## 3. Slow-query log evidence (>100ms, observed in real dev usage)

| Query                                              | Duration | Status                                                               |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `Priority WHERE reportSectionId ORDER BY rank ASC` | 232ms    | Covered by existing `@@unique([reportSectionId, rank])` — cold start |
| `Priority WHERE reportSectionId ORDER BY rank ASC` | 124ms    | (second occurrence)                                                  |
| `Report ORDER BY periodStart DESC`                 | 124ms    | **NEW** `@@index([periodStart(sort: Desc)])`                         |
| `ReminderRule ORDER BY createdAt DESC`             | 125ms    | **NEW** `@@index([createdAt(sort: Desc)])`                           |
| `ReminderExecution ORDER BY createdAt DESC`        | 107ms    | **NEW** `@@index([createdAt(sort: Desc)])`                           |
| `User WHERE email`                                 | 110ms    | Already covered by `@unique`                                         |

## 4. Indexes added (migration `20260506073948_perf_indexes_phase_39_03`)

18 new B-tree indexes across 9 tables. Justification per index:

```
Decision_reportSectionId_idx          ← Item/Risk/Decision/Priority all loaded
Item_reportSectionId_idx                  per-section in lead-form render path.
Item_projectId_idx                        FK columns aren't auto-indexed by
Risk_reportSectionId_idx                  Postgres; Prisma doesn't add them.
Risk_projectId_idx

PdfExportJob_reportId_idx             ← admin DLQ + per-report job history
PdfExportJob_status_createdAt_idx       (status filter + sort = compound)

Project_leadId_idx                    ← admin Products tab "by lead" filter
Project_archived_idx                  ← admin Products tab archived toggle

ReminderExecution_createdAt_idx       ← slow-query evidence (107ms)
ReminderExecution_ruleId_idx          ← FK without index
ReminderExecution_status_idx          ← admin reminders panel filter

ReminderRule_createdAt_idx            ← slow-query evidence (125ms)
ReminderRule_status_fireAt_idx        ← scheduler queries by (status, fireAt)

Report_periodStart_idx                ← slow-query evidence (124ms)
Report_status_periodStart_idx         ← archive list (status + sort)

ReportSection_authorId_idx            ← lead "my history" path
ReportSection_status_idx              ← head "submitted only" filter
```

## 5. pg_stat_statements wired

`docker-compose.yml` now boots Postgres with `shared_preload_libraries=pg_stat_statements`

- `log_min_duration_statement=200` (logs any SQL >200ms to docker stderr).
  The extension is created on first init via `deploy/postgres/init-pg-stat-statements.sql`.

After the dev stack has been hit for a few minutes:

```bash
docker compose exec postgres psql -U customreport -c "
  SELECT round(total_exec_time::numeric, 1) AS total_ms,
         calls,
         round(mean_exec_time::numeric, 2) AS mean_ms,
         round((100 * total_exec_time / sum(total_exec_time) over ())::numeric, 1) AS pct,
         substring(query, 1, 100) AS query
  FROM pg_stat_statements
  WHERE query NOT LIKE '%pg_stat_statements%'
  ORDER BY total_exec_time DESC
  LIMIT 20;
"
```

This is the production-grade replacement for the api-side slow-query log
once we have real traffic — `pg_stat_statements` aggregates parametrised
queries (vs the api log which prints them with bind vars expanded).

## 6. Caching opportunities (next phase, NOT implemented in 39-03)

Based on the call-count data above, the 4 admin polling procedures are the
clearest candidates for a Redis cache layer:

| Procedure                  | Calls | Avg ms | Suggested cache                     |
| -------------------------- | ----- | ------ | ----------------------------------- |
| `admin.dlqCount`           | 375   | ~10    | Redis 15s TTL, key per period       |
| `admin.snapshot`           | 177   | 13     | Redis 30s TTL, key per period       |
| `admin.getSettings`        | 176   | 17     | Redis 60s TTL, invalidate on update |
| `admin.pendingReopenCount` | 78    | ~10    | Redis 15s TTL                       |

Estimated DB load reduction: ~700 fewer queries per dev session at current
poll rates — meaningful when 6 admins are logged in simultaneously in prod.

The pattern is already wired: `BullMQModule` provides Redis connection;
adding a `@nestjs/cache-manager` + `cache-manager-ioredis-yet` wrapper
around these four service methods is a focused sub-plan. Not done in 39-03
because:

- it's behaviour-changing (cache-stale window) and needs UX review (e.g.
  "DLQ count delayed by 15s" is acceptable; "settings update delayed by
  60s" needs invalidation wired);
- 39-03 scope is "indexes + audit"; caching is a v8.1 candidate.

## 7. Full-text search — NOT NEEDED in v8.0

The user asked about FTS as part of the maturity bar. Today the searchable
free-text fields are short:

- `Item.text` (item body, ~1 sentence)
- `Risk.risk` / `Risk.impact` / `Risk.mitigation`
- `Decision.text`
- `Project.name`

There's no UI surface that exposes search. No API procedure takes a
`q: string`. Adding `tsvector` columns + GIN indexes would create
maintenance burden (trigger or generated column, locale-aware tokeniser
for Russian — `russian` text-search config) for zero current consumers.

**Recommended:** add FTS WHEN a search UI lands (likely v8.1 lead-history
filter or v8.2 cross-period search). At that point: generated `tsvector`
column on Item.text + Risk + Decision, GIN index, single combined
`searchable_text` view with `to_tsvector('russian', ...)` + `pg_trgm` for
prefix-match autocomplete.

## 8. Verification

```bash
# Apply the migration
DATABASE_URL=... pnpm exec prisma migrate dev
# 18 CREATE INDEX statements applied

# Re-boot dev stack to pick up pg_stat_statements
docker compose down postgres && docker compose up -d postgres

# Confirm extension loaded
docker compose exec postgres psql -U customreport -c \
  "SELECT * FROM pg_stat_statements LIMIT 1"
```

After a few minutes of E2E / manual smoke:

```bash
# Re-run the slow-query rollup; expect zero hits on the previously-slow
# queries (Report ORDER BY periodStart, ReminderRule/Execution ORDER BY
# createdAt) since indexes now cover them.
grep "slow query" apps/api/.logs/api.log | tail -20
```
