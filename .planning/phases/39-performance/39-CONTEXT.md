# Phase 39: Performance — Context

**Gathered:** 2026-05-05 (post-hoc scaffold; no plans started — fresh phase for autonomous run)
**Status:** Ready for planning
**Mode:** Post-hoc scaffold — full milestone detail in `.planning/milestones/v8.0-ROADMAP.md`

<domain>
## Phase Boundary

Performance baseline before production scale-up:
- PgBouncer in prod compose (transaction mode, pool=20) so the API can scale horizontally without thundering-herd on Postgres.
- Turbopack experiment to drop the `--webpack` pin (the runaway bug that pinned us is now closed).
- pg_stat_statements enabled for an index audit; CREATE INDEX migration covers the top 10 slow queries.
- k6 load test baseline: 50 concurrent leads × 5 weeks of submit + view; p95 < 300ms reads, p95 < 800ms submit.

In scope: PgBouncer service in docker-compose.prod.yml, Prisma DATABASE_URL pgbouncer-aware (connection_limit=1 runtime, DIRECT_URL bypasses pool for migrate); apps/web dev script Turbopack experiment + revert path; pg_stat_statements extension + index audit + migration; k6 baseline test + results doc.

Out of scope: caching layer for tRPC responses (Phase 30 added Redis cache for analytics, that's enough); query plan visualizer / slow-query alert; load test against staging real-IdP (samlify mock is enough for unit-level perf).
</domain>

<decisions>
## Implementation Decisions

- **PgBouncer transaction mode (not session):** OLTP workload, short-lived queries, no LISTEN/NOTIFY. Transaction mode lets thousands of app connections share <100 real DB connections.
- **Prisma DATABASE_URL annotated `pgbouncer=true&connection_limit=1`:** pool-aware. DIRECT_URL stays direct-to-Postgres for migrate (PgBouncer can't run DDL through transaction mode).
- **Turbopack experiment is reversible:** the bug that pinned us is closed (CLS correlationId, env loading, stub mode). If runaway returns, immediate revert; document trigger in COMMENT.
- **Index audit methodology:** run E2E + UAT suite + a representative seed-load 100x; capture top 10 by `total_exec_time` from pg_stat_statements; CREATE INDEX for each that doesn't conflict with existing uniques.
- **k6 targets calibrated to seed scale:** 50 concurrent leads is 8x larger than seed (6 leads). Targets (p95 300/800ms) give headroom — exceed them and we know to tune before customer rollout.

</decisions>

<code_context>
## Existing Code Insights

- `prisma/schema.prisma` datasource block — needs annotation in 39-01.
- `docker-compose.prod.yml` already has Postgres + Redis services from Phase 38-01; PgBouncer slots in between.
- `apps/web/package.json` dev script: `next dev --webpack`. 39-02 drops the flag; restart + smoke test.
- `apps/api/.logs/api.log` — observable for slow queries via existing prom-client metrics; 39-03 cross-references with pg_stat_statements.

</code_context>

<specifics>
## Specific Ideas

- 39-01 PgBouncer: edgedb/pgbouncer image; auth_type=md5; pool_mode=transaction; max_client_conn=1000; default_pool_size=20.
- 39-02 Turbopack: drop `--webpack`, optionally add `turbopack: { root: '..' }` to next.config.ts for monorepo workspace detection.
- 39-03 indexes: candidate hot paths from existing tRPC profile — `weeklyReport.get` (Report+ReportSection+Item joins), `archive.list` (paginated published reports), `analytics.trafficLightHistory` (already has Redis cache but underlying Prisma still slow).
- 39-04 k6: dual-server config, each VU is a lead going through dashboard → /lead/report → save 3 items → submit. Mix 80/20 read/write.

</specifics>

<deferred>
## Deferred Ideas

- HTTP/3 / QUIC at the reverse-proxy — caddy supports it; not v8.0 scope.
- Server-side rendering of /reports/trends with cached HTML — Next.js App Router does this implicitly; nothing to add.
- Lazy-load Anthropic SDK — if AI cost becomes a concern; metric-driven decision after a month of prod usage.

</deferred>
