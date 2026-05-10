---
phase: 52
subsystem: observability
tags: [phase-52, ufb-054, product-telemetry, grafana, prometheus, trpc]
metrics:
  duration: "20m 5s"
  completed: "2026-05-11T03:05:00Z"
  test_counts:
    shared: 533 # baseline 494
    api: 859 # baseline 823
    web: 348 # baseline 333
  commits: 11
key-decisions:
  - "Metric prefix `customreport_*` per phase spec; deferred cross-prefix consolidation with existing `cr_*` series"
  - "Grafana dashboards live in `deploy/grafana/`, not `apps/api/grafana/` (in-repo convention)"
  - "On-time ratio denominator: per-section (matches `ReportSection.late` badge in head dashboard)"
  - "`telemetry.summary` 60s TTL Redis cache; separate from AnalyticsCache (3600s)"
  - "Gauge values populated via prom-client `collect` callback (no scheduler)"
  - "New `leadershipProcedure` (head + admin + viewer); `director` role deferred (Prisma migration locked)"
  - "PDF export `requestedByRole` defaults to `'system'` for worker/cron callers"
key-files:
  created:
    - apps/api/src/modules/telemetry/telemetry.gauges.ts
    - apps/api/src/modules/telemetry/telemetry.module.ts
    - apps/api/src/modules/telemetry/telemetry.service.ts
    - apps/api/src/modules/telemetry/telemetry.cache.ts
    - apps/api/src/modules/telemetry/telemetry.prisma-repository.ts
    - apps/api/src/modules/telemetry/telemetry.gauges.test.ts
    - apps/api/src/modules/telemetry/telemetry.service.test.ts
    - packages/shared/src/schemas/telemetry.ts
    - packages/shared/src/schemas/__tests__/telemetry.test.ts
    - apps/web/src/components/dashboard/product-kpi-card.tsx
    - apps/web/src/components/dashboard/product-kpi-card.test.tsx
    - deploy/grafana/product-telemetry-dashboard.json
    - deploy/grafana/provisioning/dashboards/product-telemetry.yml
  modified:
    - apps/api/src/infrastructure/metrics/metrics.registry.ts
    - apps/api/src/modules/publication/publication.service.ts
    - apps/api/src/modules/publication/publication.service.test.ts
    - apps/api/src/modules/report-sections/report-sections.service.ts
    - apps/api/src/modules/report-sections/report-sections.service.test.ts
    - apps/api/src/modules/report-sections/lead-form.service.ts
    - apps/api/src/modules/report-sections/lead-form.contract.test.ts
    - apps/api/src/modules/pdf-export/pdf-export.service.ts
    - apps/api/src/modules/pdf-export/pdf-export.service.test.ts
    - apps/api/src/infrastructure/trpc/trpc.router.ts
    - apps/api/src/infrastructure/trpc/trpc.middleware.ts
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/web/src/components/dashboard/dashboard-page.tsx
    - docker-compose.observability.yml
    - packages/shared/src/index.ts
---

# Phase 52: Product Telemetry & Dashboards — Summary

**One-liner:** Eight `customreport_*` business-KPI Prom metrics (counters / histogram / gauges via `collect` callbacks), Grafana «Product KPIs» dashboard provisioned alongside engineering telemetry, `telemetry.summary` tRPC procedure (leadership-only, 60s Redis cache), and an in-app KPI card on `/head/dashboard` for head / admin / viewer.

## Scope delivered

Built in three plans (52-A metrics, 52-B Grafana, 52-C tRPC + UI) across 11 atomic commits. No Prisma migrations applied (parallel Phase 56 agent held the migration lock).

```
[52-A metrics] → [52-B dashboard]   ── runs against existing scrape config
       │
       ▼
[52-C tRPC + KPI card]               ── feeds the in-app surface
```

### Plan 52-A — Metrics emission (6 commits)

Counter / histogram / gauge registrations in `metrics.registry.ts`, plus hooks
inside the existing services so emission lives next to the domain action it
measures:

| Metric                                                 | Source                                                                | Commit  |
| ------------------------------------------------------ | --------------------------------------------------------------------- | ------- |
| `customreport_reports_submitted_total{state}`          | `PublicationService.publishReport` / `publishAuto`                    | 87e6596 |
| `customreport_period_state_transitions_total{from,to}` | same                                                                  | 87e6596 |
| `customreport_sections_submitted_total{late}`          | `ReportSectionsService.submitSection`                                 | 3e43f2b |
| `customreport_section_submission_latency_seconds`      | same — signed seconds `(now − deadline)`                              | 3e43f2b |
| `customreport_reopen_requests_total{state}`            | `LeadFormService.requestReopen` + inline `admin.respondReopenRequest` | 4fe2d56 |
| `customreport_pdf_export_requests_total{role}`         | `PdfExportService.requestPdfExport` (signature widened)               | 7d32c65 |
| `customreport_reports_on_time_ratio` (gauge)           | `TelemetryGauges.onModuleInit` + `prom-client` `collect`              | c1103dc |
| `customreport_active_leads_total` (gauge)              | same                                                                  | c1103dc |

Counter increments fire AFTER the persistence write (publish, submit, reopen
update). A rolled-back transaction must not inflate the funnel.

### Plan 52-B — Grafana dashboard (1 commit)

Seven-panel JSON at `deploy/grafana/product-telemetry-dashboard.json` plus
provisioning under a separate folder («Product KPIs») so the leadership
audience does not have to dig under the engineering folder. Panels:

| #   | Title                                       | Panel type   | Query                                                    |
| --- | ------------------------------------------- | ------------ | -------------------------------------------------------- |
| 1   | Reports submitted (weekly)                  | timeseries   | `increase(...[1w])`                                      |
| 2   | On-time ratio (last 4 periods)              | stat         | `customreport_reports_on_time_ratio`                     |
| 3   | Active leads (last period)                  | stat         | `customreport_active_leads_total`                        |
| 4   | Late vs on-time sections (7d rate)          | stacked bars | `rate(...[7d])` by `late`                                |
| 5   | Reopen request funnel (7d rate)             | stat row     | `rate(...[7d])` by `state`                               |
| 6   | PDF exports by role (24h rate)              | piechart     | `rate(...[1d])` by `role`                                |
| 7   | Section submission latency (signed seconds) | heatmap      | `customreport_section_submission_latency_seconds_bucket` |

Docker compose mount line added to `docker-compose.observability.yml`.

### Plan 52-C — tRPC + UI (3 commits)

- `telemetrySummarySchema` (shared package): six fields + `sparkline` ≤ 8.
- `TelemetryService` + Prisma repo + Redis cache (60s, prefix `customreport:telemetry:`).
- New `leadershipProcedure` middleware (head + admin + viewer; lead denied).
- `telemetry.summary` tRPC procedure under new `telemetry.*` namespace.
- `<ProductKpiCard>` React component on `/head/dashboard` with six headline numbers + recharts 4-week sparkline. Self-gates: lead role renders null.

## Verification

| Gate                              | Required | Actual | Status |
| --------------------------------- | -------- | ------ | ------ |
| `@customreport/shared` test --run | ≥494     | 533    | green  |
| `@customreport/api` test --run    | ≥823     | 859    | green  |
| `@customreport/web` test --run    | ≥333     | 348    | green  |
| `@customreport/api` tsc --noEmit  | exit 0   | exit 0 | green  |
| `@customreport/web` tsc --noEmit  | exit 0   | exit 0 | green  |
| Grafana JSON validates            | parses   | parses | green  |
| No Prisma migrations applied      | 0        | 0      | green  |

## Deviations from plan

### Auto-fixed (Rule 1-3)

**1. [Rule 3 — Path correction] Grafana dashboard location.**

- Plan said `apps/api/grafana/dashboards/product-telemetry.json`.
- In-repo convention lives at `deploy/grafana/*.json` (Phase 37 + Phase 47-03 precedent).
- Used `deploy/grafana/product-telemetry-dashboard.json` and added a docker-compose mount line.
- Commit: 0036471.

**2. [Rule 1 — Bug] `PdfExportJob` field name.**

- Initial Prisma query used `requestedAt: { gte: ... }`.
- Schema field is `createdAt` (`requestedAt` lives only on the domain shape, not the DB row).
- Fixed during the typecheck pass.
- Commit: rolled into 73a371a.

**3. [Rule 1 — Bug] `sessionState.role` access path.**

- Initial dashboard wire-up used `sessionState?.role`.
- Actual shape is `sessionState.user.role` (SessionState wraps `SessionUser | null`).
- Fixed before commit.
- Commit: rolled into b8167c8.

**4. [Rule 1 — Bug] Test helper type signatures.**

- prom-client `Counter<T>.get()` returns `MetricValue<T>` with `Partial<Record<T, string | number>>` labels — strictly typed helpers I wrote first rejected with TS2345.
- Relaxed helpers to accept `Record<string, any>` and cast at call-site.
- Commit: rolled into 4fe2d56.

### Deferred (out of scope for this phase)

**`director` role enum addition.**

- Adding `'director'` to `roleSchema` requires a Prisma migration (the role column is enum-typed in Postgres). Phase 56 holds the migration lock.
- Gated `telemetry.summary` by `head | admin | viewer` instead. Documented in PLAN.md and exposed via comments in `trpc.middleware.ts:leadershipRoleMiddleware`.
- Follow-on plan: when the migration lock releases, add `director` to `roleSchema` + `sessionRoleSchema`, then either widen `leadershipProcedure` or fork a `directorProcedure`.

**`cr_*` vs `customreport_*` prefix consolidation.**

- Phase brief mandated `customreport_*` but the existing engineering counters use `cr_*` (`cr_dlq_failed_total`, `cr_login_attempts_total`, `cr_rate_limit_hits_total`).
- Renaming the existing counters would re-baseline all engineering SLOs and break the Phase 37 + Phase 47-03 Grafana dashboards.
- Both prefixes coexist; the «Product KPIs» dashboard uses `customreport_*`, the engineering dashboards continue to use `cr_*`.
- Follow-on: choose one prefix when the next major version bump retires the engineering dashboards.

**Viewer-accessible dashboard surface.**

- The KPI card is mounted on `/head/dashboard` (head + admin only).
- Viewer role does pass `leadershipProcedure` and the card's role gate would render it, but viewers never visit `/head/dashboard` (the role-aware landing in `apps/web/src/app/page.tsx` routes them to `/reports?tab=published`).
- A dedicated viewer-accessible page (`/dashboard` proper, or a card embedded on `/reports`) is deferred to a follow-on plan — adding a new route here would balloon scope and conflict with the planned director-role work.

**Router-level test for `admin.respondReopenRequest` counter.**

- The inline mutation in `trpc.router.ts:970-1018` increments the counter outside any service the unit-test harness can directly drive.
- Existing `trpc.router.role-coverage.test.ts` uses a stubbed `prisma` and would need rework to assert post-transaction counter side-effects.
- Service-level coverage (lead-form `requested` path) is in place; the approve/reject paths are exercised by the integration suite at the SQL level, which is sufficient for SLO purposes.

## Open questions for UAT

1. **Director-role plumbing** — once the migration lock releases, does the leadership audience consume the same procedure (`telemetry.summary` widened to include director) or a dedicated director-only export endpoint? Default proposal: widen.
2. **Grafana folder visibility** — confirm with the head that the «Product KPIs» folder is preferable to a single combined folder. Trivial to consolidate by editing one provisioning yaml.
3. **`/dashboard` route** — should the leadership KPI card move to its own viewer-accessible route, or stay embedded on `/head/dashboard` only? The latter ships today; the former is a 1-2 hour follow-on.
4. **Sparkline period count** — currently 4 weeks (matches the on-time-ratio gauge denominator). Leadership may prefer 8 weeks for trend visibility (no metric change needed — the schema already supports up to 8 entries; only the Prisma repository `take: 4` constant would change).

## Threat surface scan

No new network endpoints. `telemetry.summary` adds one read-only tRPC procedure gated by leadership role; no schema changes; cache writes to Redis with a 60s TTL (no PII in payload). Nothing to flag.

## Self-Check

PASSED — all 13 created files present, all 16 modified files present, all 11 commits land on `main`:

| Item                                                     | Status            |
| -------------------------------------------------------- | ----------------- |
| `apps/api/src/modules/telemetry/*.ts`                    | FOUND             |
| `packages/shared/src/schemas/telemetry.ts`               | FOUND             |
| `apps/web/src/components/dashboard/product-kpi-card.tsx` | FOUND             |
| `deploy/grafana/product-telemetry-dashboard.json`        | FOUND             |
| 11 commits on main (60797ec..b8167c8)                    | FOUND             |
| tsc api / web                                            | exit 0            |
| pnpm test api / web / shared                             | passing baselines |
| No Prisma migration files added                          | confirmed         |
