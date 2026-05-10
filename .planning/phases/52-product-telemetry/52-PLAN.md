---
phase: 52
plan: product-telemetry
type: feature
autonomous: true
requirements: [UFB-054]
audience: all # head + viewer + admin (director role deferred — see Open Questions)
---

# Phase 52 — Product Telemetry & Dashboards

## Objective

Add **product / business-KPI telemetry** alongside the engineering telemetry shipped in Phase 47-03. Six leadership-readable KPIs land in Prometheus, a Grafana «Product KPIs — Demo CustomReport» dashboard visualises them, and a tRPC `telemetry.summary` procedure exposes the same numbers to head / admin / viewer roles inside the app (KPIs card on `/dashboard`).

## Context (load on demand)

@apps/api/src/infrastructure/metrics/metrics.registry.ts
@apps/api/src/modules/publication/publication.service.ts
@apps/api/src/modules/report-sections/report-sections.service.ts
@apps/api/src/modules/report-sections/lead-form.service.ts
@apps/api/src/modules/pdf-export/pdf-export.service.ts
@apps/api/src/infrastructure/trpc/trpc.router.ts
@deploy/grafana/customreport-dashboard.json
@deploy/grafana/provisioning/dashboards/customreport.yml

## Hard constraints (from caller)

- **No Prisma migrations** in this phase — parallel agent (Phase 56) holds the migration lock.
  All metrics derive from existing schema (`Report.status` / `Report.periodState` /
  `Report.deadline` / `Report.late` / `ReportSection.late` / `ReportSection.status` /
  `ReportSection.submittedAt` / `User.role` / `ReopenRequest.status`).
- **No new role enums** — `director` does not exist in `roleSchema`; adding it requires
  a Prisma migration + cascades into 5+ test files. Gate telemetry by `head | admin | viewer`
  and document the deferred `director` work in the SUMMARY.
- Atomic per-task commits. Husky hooks active. No `--no-verify`.
- Commit prefix style: `feat(api|web|obs): UFB-054 — short (52-X)`.

## Decisions locked at planning time

1. **Metric prefix.** Task specifies `customreport_*` even though existing counters use `cr_*` (`cr_dlq_failed_total`, `cr_rate_limit_hits_total`). Follow the task; flag the cross-prefix inconsistency in the SUMMARY as a deferred consolidation.
2. **Dashboard path.** Task says `apps/api/grafana/dashboards/` but the in-repo convention is `deploy/grafana/`. Use `deploy/grafana/product-telemetry-dashboard.json` and add a second provisioning provider entry (`deploy/grafana/provisioning/dashboards/product-telemetry.yml`) so the new dashboard lands in a separate Grafana folder («Product KPIs»). Rule 3 path-correction; note in SUMMARY.
3. **Gauge recompute strategy.** Use `prom-client` `Gauge.collect` async callback for the two query-backed gauges (`on_time_ratio`, `active_leads_total`). No scheduler. Queries are indexed and `LIMIT 4`-period scoped → sub-100ms.
4. **On-time ratio denominator.** Per-**section** (matches the existing `ReportSection.late` badge surfaced in the head dashboard). Numerator = sections with `late=false AND status='submitted'`; denominator = all sections with `status='submitted'` over the last 4 published periods.
5. **`telemetry.summary` cache.** Build a small parallel `TelemetryCache` (mirror of `AnalyticsCache` shape) with `customreport:telemetry:` prefix and 60s TTL. Do NOT reuse `AnalyticsCache` (hard-codes 3600s + different prefix).
6. **UI charting.** `recharts@^3.8.1` is already in `apps/web/package.json` — use it for the sparkline.
7. **Reopen approve/reject hook.** Lives inline in `trpc.router.ts:970-1018` (`admin.respondReopenRequest`). Increment the counter inline next to the transaction; do NOT refactor into a new ReopenService.

## Metrics inventory (the 8 product KPIs)

| Metric                                            | Kind      | Labels       | Source                                                                |
| ------------------------------------------------- | --------- | ------------ | --------------------------------------------------------------------- |
| `customreport_reports_submitted_total`            | Counter   | `state`      | `PublicationService.publishReport/publishAuto`                        |
| `customreport_sections_submitted_total`           | Counter   | `late`       | `ReportSectionsService.submitSection`                                 |
| `customreport_section_submission_latency_seconds` | Histogram | (no labels)  | `ReportSectionsService.submitSection` (deadline−now)                  |
| `customreport_reports_on_time_ratio`              | Gauge     | (no labels)  | `Gauge.collect` over last-4-period sections                           |
| `customreport_active_leads_total`                 | Gauge     | (no labels)  | `Gauge.collect` distinct authorId last published period               |
| `customreport_reopen_requests_total`              | Counter   | `state`      | `LeadFormService.requestReopen` + `admin.respondReopenRequest` inline |
| `customreport_pdf_export_requests_total`          | Counter   | `role`       | `PdfExportService.requestPdfExport` (role passed through router)      |
| `customreport_period_state_transitions_total`     | Counter   | `from`, `to` | `PublicationService.publishReport/publishAuto` + auto-archiver        |

`section_submission_latency_seconds` histogram buckets: `[-86400, -43200, -3600, 0, 3600, 14400, 43200, 86400, 259200]` (signed seconds; negative = submitted before deadline, positive = late). The negative-side bucketing is the «how-early» distribution that leadership asks about.

## Tasks

### Plan 52-A — Metrics emission

**Task 1** [auto] — Add 8 product metrics to `metrics.registry.ts`. Pure registry-only diff. Verification: `pnpm --filter @customreport/api exec tsc --noEmit`. Commit: `feat(api): UFB-054 — register product KPI metrics (52-A.1)`.

**Task 2** [auto] — Hook `PublicationService.publishReport` and `publishAuto`: increment `customreport_reports_submitted_total{state='published'}` + `customreport_period_state_transitions_total{from='open',to='published'}`. Unit-test that both methods bump the counters. Commit: `feat(api): UFB-054 — emit publish metrics (52-A.2)`.

**Task 3** [auto] — Hook `ReportSectionsService.submitSection`: increment `customreport_sections_submitted_total{late=true|false}` and observe `customreport_section_submission_latency_seconds` (signed seconds: `deadline − now`). Unit-test that the histogram observes the signed delta. Commit: `feat(api): UFB-054 — emit section submission metrics (52-A.3)`.

**Task 4** [auto] — Hook `LeadFormService.requestReopen` (counter `state='requested'`) and the inline `admin.respondReopenRequest` mutation (counter `state='approved'|'rejected'`). For the inline router path, add the counter increment right after the transaction commits. Unit tests stay in `lead-form.service.test.ts` for the requested path; router-level test deferred (router tests live in `trpc.router.role-coverage.test.ts`; adding a counter assertion there would require a router-test rework — defer and document). Commit: `feat(api): UFB-054 — emit reopen request metrics (52-A.4)`.

**Task 5** [auto] — Hook `PdfExportService.requestPdfExport` — extend signature with optional `requestedByRole?: 'head'|'admin'|'viewer'|'lead'` (default `'unknown'`); increment `customreport_pdf_export_requests_total{role}`. Update the tRPC `pdfExport.request` call site to pass `ctx.session.role`. Unit-test that role is recorded. Commit: `feat(api): UFB-054 — emit PDF export role metric (52-A.5)`.

**Task 6** [auto] — Add the two gauge `collect` callbacks: `on_time_ratio` (last 4 published periods) and `active_leads_total` (distinct authorIds with submitted section in the last published period). Wire them via a thin `TelemetryGauges` service registered in `AppModule`. Unit-test with Prisma-mocked queries that the gauges set the expected values. Commit: `feat(api): UFB-054 — gauge collect callbacks for KPIs (52-A.6)`.

### Plan 52-B — Grafana dashboard

**Task 7** [auto] — Create `deploy/grafana/product-telemetry-dashboard.json` with 7 panels:

1. **Reports submitted by week** — `sum(increase(customreport_reports_submitted_total[1w]))`.
2. **On-time ratio (4-wk rolling)** — `customreport_reports_on_time_ratio` (stat panel, percent).
3. **Active leads (last period)** — `customreport_active_leads_total` (stat panel).
4. **Late vs on-time sections** — `sum by (late) (rate(customreport_sections_submitted_total[1w]))` stacked bar.
5. **Reopen request funnel** — `sum by (state) (rate(customreport_reopen_requests_total[7d]))` (stat row: requested / approved / rejected).
6. **PDF exports by role** — `sum by (role) (rate(customreport_pdf_export_requests_total[1d]))` pie chart.
7. **Section submission latency distribution** — heatmap of `customreport_section_submission_latency_seconds_bucket`.

Provisioning: add `deploy/grafana/provisioning/dashboards/product-telemetry.yml` (folder=«Product KPIs», path=`/var/lib/grafana/dashboards/product-telemetry`). Mount path TBD in docker-compose — if mount path missing, document and defer compose change (lock-friendly; no DB migration).

Validation: `python3 -c "import json; json.load(open('deploy/grafana/product-telemetry-dashboard.json'))"` passes.

Commit: `feat(obs): UFB-054 — Product KPIs Grafana dashboard (52-B)`.

### Plan 52-C — `telemetry.summary` tRPC + UI

**Task 8** [auto] — Add `telemetrySummarySchema` to `packages/shared/src/schemas/telemetry.ts` and export from package index. Shape: `{ reportsThisPeriod, onTimeRatio, activeLeads, lateSections, pendingReopens, pdfExportsLast7d, sparkline: number[] }`. Unit test in `packages/shared`. Commit: `feat(shared): UFB-054 — telemetrySummarySchema (52-C.1)`.

**Task 9** [auto] — Build `TelemetryService` (`apps/api/src/modules/telemetry/telemetry.service.ts`) that reads Prisma + composes the schema. Cache with new `TelemetryCache` (60s TTL, `customreport:telemetry:` prefix). Custom role middleware `buildRoleMiddleware(['head','admin','viewer'])` exposed inside the telemetry router file. Unit tests for service (mocked Prisma + cache port). Commit: `feat(api): UFB-054 — telemetry.summary tRPC procedure (52-C.2)`.

**Task 10** [auto] — Web KPI card on `/dashboard`. shadcn `<Card>` with the 6 main numbers + a 4-week sparkline (recharts `<LineChart>`). Visible only when `session.role !== 'lead'`. RTL test verifies the card renders for `head` and is absent for `lead`. Commit: `feat(web): UFB-054 — KPI card on dashboard (52-C.3)`.

## Verification (run at end)

```bash
pnpm --filter @customreport/api test --run          # ≥823
pnpm --filter @customreport/web test --run          # ≥333
pnpm --filter @customreport/shared test --run       # ≥494
pnpm --filter @customreport/api exec tsc --noEmit   # exit 0
pnpm --filter @customreport/web exec tsc --noEmit   # exit 0
python3 -c "import json; json.load(open('deploy/grafana/product-telemetry-dashboard.json'))"
```

## Success criteria

- [ ] 8 new product KPI metrics registered and emitted from the live code paths.
- [ ] Grafana dashboard JSON validates and ships in the same provisioning model as Phase 37.
- [ ] `telemetry.summary` returns the JSON shape, gated by head/admin/viewer, cached 60s.
- [ ] `/dashboard` KPI card renders for non-lead roles.
- [ ] All tsc + test gates green (counts ≥ baselines).
- [ ] Zero Prisma migrations applied.
- [ ] SUMMARY documents the `director` role deferral and the path / prefix deviations.

## Open Questions for SUMMARY

- `director` role enum addition (deferred — needs Prisma migration; parallel agent holds lock).
- `cr_*` vs `customreport_*` prefix consolidation (deferred — would rename existing counters; SLOs would re-baseline).
- Compose-mount for the `product-telemetry` Grafana folder (defer until UAT for the dashboard if compose change needed).
