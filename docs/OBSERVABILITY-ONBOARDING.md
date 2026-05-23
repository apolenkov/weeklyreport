# Observability Onboarding

**Audience:** new engineers + on-call rotation joiners.
**Scope:** where to look when something is on fire — Grafana, Prometheus,
log files, OpenTelemetry traces, BullMQ queues, audit log.

This is intentionally short. Bookmark the URLs, run the quick-start once,
trust the runbook for the deeper triage paths.

## Quick start

```bash
# Bring up the local observability stack on top of dev:
pnpm observability:up

# Watch live API logs (rotated, gzip'd, 30 d retention):
pnpm logs

# Filter to error/warn only:
pnpm logs:errors
```

## Endpoints (local dev defaults)

| Surface           | URL                                | Purpose                                        |
| ----------------- | ---------------------------------- | ---------------------------------------------- |
| Grafana           | http://localhost:3003              | dashboards, Explore → Loki logs / Tempo traces |
| OTel Collector    | http://localhost:4318              | OTLP HTTP endpoint (API traces + metrics)      |
| Prometheus        | http://localhost:9090              | raw metric query / debug                       |
| Bugsink           | http://localhost:8000              | error tracking UI (admin/admin)                |
| `/metrics` (API)  | http://localhost:3002/metrics      | scrape target, Prometheus exposition           |
| `/health/live`    | http://localhost:3002/health/live  | liveness — process up                          |
| `/health/ready`   | http://localhost:3002/health/ready | readiness — DB + Redis + BullMQ + memory       |
| Bull Board        | http://localhost:3002/admin/queues | BullMQ jobs UI (head/admin only)               |
| Postgres exporter | http://localhost:9187/metrics      | DB-side metrics                                |
| Redis exporter    | http://localhost:9121/metrics      | Redis-side metrics                             |

Production endpoints follow the same shape but live behind the corporate
proxy — see `RUNBOOK.md` Section 1 for ingress hostnames + auth gate.

## Default Grafana dashboards

```
deploy/grafana/dashboards/
├── customreport-dashboard.json    # API latency, BullMQ, Postgres, AI
├── trpc-latency-dashboard.json    # tRPC p50/p95/p99 by procedure
└── product-telemetry-dashboard.json  # product KPI metrics (Phase 52)
```

Open Grafana → "Browse" → folder "CustomReport" → pick a dashboard.

Login: `admin / admin` on first launch.

## Traces (Tempo)

OTel SDK is wired into `apps/api/src/main.ts` and instruments HTTP +
Prisma. Enabled when `OTEL_EXPORTER_OTLP_ENDPOINT` is set:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-lgtm:4318
OTEL_SDK_DISABLED=false
OTEL_TRACE_SAMPLER_ARG=1.0   # 100% sampling in dev, 0.1 in prod
```

View traces: Grafana → Explore → select **Tempo** datasource → search by
`correlationId` or service name.

## Logs (Loki)

Structured JSON logs are shipped to Loki via the OTel Collector. View in
Grafana → Explore → select **Loki** datasource → filter by `{job="api"}`.

Local log files (also available without Grafana):

```
apps/api/.logs/app.log                 # current
apps/api/.logs/app.log.YYYY-MM-DD.gz   # archive
```

Every log line carries `phase`, `correlationId`, `traceId`, `userId`
(when available) so tracing a single request is `grep <correlationId>`.

## Error tracking (Bugsink)

Bugsink is a Sentry-compatible error tracking server. Unhandled exceptions
and 5xx errors are captured automatically via `@sentry/nestjs`.

UI: http://localhost:8000 — login `admin` / `admin`.

Each error shows a full stack trace, request context, and environment.
Link errors to Tempo traces via the `traceId` field.

## Audit log

User-visible audit trail lives in the `UserActionLog` table and is mirrored
into the admin UI:

```
http://localhost:3000/admin?tab=actions
```

Each row carries a `correlationId` you can paste into Grafana / Loki to
pull the full request trace.

## When something breaks

1. `pnpm logs:errors` — fastest signal.
2. `/health/ready` — is the API even healthy.
3. Bull Board → DLQ — failed background jobs (PDF, email).
4. Grafana "API latency" → look for the latency spike or 5xx surge.
5. Bugsink (http://localhost:8000) → check for new error issues with stack trace.
6. Action Log tab → grab the `correlationId` of the affected user's last
   action; cross-reference with logs.
7. Escalate per `RUNBOOK.md` if the root cause isn't obvious in 10 min.

## Credentials reference

```
Grafana          admin / admin   (first-run)
Bugsink          admin / admin   (first-run, change in prod)
Bull Board       /admin/queues — Keycloak SSO, head/admin role only
Prometheus       no auth (corporate VPN gates external access)
```

## Pointers

- `RUNBOOK.md` — top 10 failure modes + rollback playbooks.
- `INCIDENT-PLAYBOOK.md` — on-call rotation + post-mortem template.
- `docs/DEPLOYMENT.md` — prod-stack diagram + Caddy/TLS topology.
- `deploy/log-sink/` — Vector + Promtail config for production log
  forwarding to the central SIEM.
