# Phase 39, Plan 03 — SUMMARY

**REQ-IDs:** PERF-03
**Status:** complete

## What shipped

- `prisma/schema.prisma` — added `@@index` declarations to 9 models (Decision, Item, Risk, PdfExportJob, Project, ReminderExecution, ReminderRule, Report, ReportSection). 18 new B-tree indexes total. Existing `@@unique` compound indexes (e.g. `Priority @@unique([reportSectionId, rank])`) untouched.
- `prisma/migrations/20260506073948_perf_indexes_phase_39_03/migration.sql` — 18 `CREATE INDEX` statements; applied to local DB via `prisma migrate dev` exit 0.
- `docker-compose.yml` — postgres `command:` now boots with `shared_preload_libraries=pg_stat_statements` + `pg_stat_statements.track=all` + `pg_stat_statements.max=10000` + `log_min_duration_statement=200`. Mounts `init-pg-stat-statements.sql` to `/docker-entrypoint-initdb.d/01-pg-stat-statements.sql:ro`.
- `deploy/postgres/init-pg-stat-statements.sql` (new) — `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` runs once on first DB init (when pgdata volume is empty).
- `.planning/PERF-AUDIT-2026-05.md` (new) — 8-section data-driven audit document. The artefact that justifies every line of the migration.

## Methodology (data-driven, not theoretical)

Per user directive ("Индексы обязательно. Зрелость"), no index added without evidence:

1. **Frequency analysis** — extracted call counts from `apps/api/.logs/api.log` (12MB, 9283 tRPC calls captured during 2026-05-04..05). Top 11 procedures account for ~30% of traffic.
2. **Latency analysis** — top 10 procedures by avg/max ms; identified `weeklyReport.get` 27ms avg but 214ms tail and `reports.getActive` 261ms tail as cold-cache (not N+1 — confirmed by reading the procedure code, both use Prisma `include` correctly with single round-trip).
3. **Slow-query log** — `PrismaService` emits queries >=100ms to api.log. 6 unique entries observed:
   - `Priority WHERE reportSectionId ORDER BY rank ASC` 232ms — already covered by `@@unique([reportSectionId, rank])`, cold start
   - `Report ORDER BY periodStart DESC` 124ms — **NEW** `@@index([periodStart(sort: Desc)])`
   - `ReminderRule ORDER BY createdAt DESC` 125ms — **NEW** `@@index([createdAt(sort: Desc)])`
   - `ReminderExecution ORDER BY createdAt DESC` 107ms — **NEW** `@@index([createdAt(sort: Desc)])`
   - `User WHERE email` 110ms — already covered by `@unique`

## Index breakdown (18 total)

```
Decision_reportSectionId_idx          ← lead-form render path (Item/Risk/Decision/Priority all loaded per-section)
Item_reportSectionId_idx              ← FK without auto-index (Postgres doesn't add; Prisma doesn't either)
Item_projectId_idx
Risk_reportSectionId_idx
Risk_projectId_idx

PdfExportJob_reportId_idx             ← admin DLQ + per-report job history
PdfExportJob_status_createdAt_idx     ← compound: status filter + sort

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

## pg_stat_statements wiring

`pg_stat_statements` is the production-grade replacement for the api-side slow-query log. The api log prints SQL with bind vars expanded (one row per execution); pg_stat_statements aggregates parametrised queries (one row per query template, with calls/total_time/mean_time stats).

Usage after the dev stack has been hit by E2E / manual smoke for a few minutes:

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

Reset stats with `SELECT pg_stat_statements_reset();`.

## What was NOT done (and why — see PERF-AUDIT § 6, § 7)

- **Caching layer for 4 admin polling procedures** (806 calls = 8.7% of traffic): documented as v8.1 candidate. Reason: behaviour-changing (cache-stale window needs UX review — "DLQ delayed by 15s" is fine; "settings update delayed by 60s" needs invalidation wiring); 39-03 scope is "indexes + audit", caching is a separate decision.
- **Full-text search via tsvector/GIN**: NOT NEEDED in v8.0. No UI surface exposes search. No API procedure takes `q: string`. Adding generated `tsvector` columns + Russian text-search config + GIN indexes would create maintenance burden for zero current consumers. Recommended timing: when search UI lands (likely v8.1 lead-history filter or v8.2 cross-period search).

## Verification

```bash
# Apply the migration (already done, kept for re-run idempotency)
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport \
  pnpm exec prisma migrate dev
# 18 CREATE INDEX statements applied

# Re-boot dev stack to pick up pg_stat_statements
docker compose down postgres && docker compose up -d postgres

# Confirm extension loaded
docker compose exec postgres psql -U customreport -c \
  "SELECT * FROM pg_stat_statements LIMIT 1"

# After E2E + manual smoke for a few minutes, expect zero new entries
# in apps/api/.logs/api.log slow-query log for the previously-slow queries
grep "slow query" apps/api/.logs/api.log | tail -20
```

## Files

- `prisma/schema.prisma` (18 @@index declarations across 9 models)
- `prisma/migrations/20260506073948_perf_indexes_phase_39_03/migration.sql` (18 CREATE INDEX)
- `docker-compose.yml` (postgres command + init script mount)
- `deploy/postgres/init-pg-stat-statements.sql` (extension bootstrap)
- `.planning/PERF-AUDIT-2026-05.md` (data-driven audit artefact)
