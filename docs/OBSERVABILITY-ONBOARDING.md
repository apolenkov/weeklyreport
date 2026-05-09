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

| Surface           | URL                                | Purpose                                  |
| ----------------- | ---------------------------------- | ---------------------------------------- |
| Grafana           | http://localhost:3010              | dashboards: API, BullMQ, Postgres, AI    |
| Prometheus        | http://localhost:9090              | raw metric query / debug                 |
| `/metrics` (API)  | http://localhost:3002/metrics      | scrape target, Prometheus exposition     |
| `/health/live`    | http://localhost:3002/health/live  | liveness — process up                    |
| `/health/ready`   | http://localhost:3002/health/ready | readiness — DB + Redis + BullMQ + memory |
| Bull Board        | http://localhost:3002/admin/queues | BullMQ jobs UI (head/admin only)         |
| Postgres exporter | http://localhost:9187/metrics      | DB-side metrics                          |
| Redis exporter    | http://localhost:9121/metrics      | Redis-side metrics                       |

Production endpoints follow the same shape but live behind the corporate
proxy — see `RUNBOOK.md` Section 1 for ingress hostnames + auth gate.

## Default Grafana dashboards

```
deploy/grafana/dashboards/
├── api-latency.json       # tRPC p50/p95/p99 by procedure
├── bullmq.json            # active / waiting / failed / DLQ counters
├── postgres.json          # connections, slow queries, replication lag
├── ai.json                # tokens, latency, cost-per-day (Phase 41)
└── rate-limit.json        # 429 buckets per IP / per route
```

Open Grafana → "Browse" → folder "CustomReport" → pick a dashboard.

Login: `admin / admin` on first launch (force a password change immediately).

## Log files

Structured JSON logs, rotate hourly + gzip after 24 h, 30 d retention:

```
apps/api/.logs/app.log                 # current
apps/api/.logs/app.log.YYYY-MM-DD.gz   # archive
```

Every log line carries `phase`, `correlationId`, `userId` (when available)
so tracing a single request is `grep <correlationId>`.

## Tracing (OpenTelemetry)

OTel SDK is wired into `apps/api/src/main.ts` and instruments HTTP +
Prisma. Disabled by default; enable via env:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SDK_DISABLED=false
OTEL_TRACE_SAMPLER_ARG=0.1   # 10 % sampling in prod, 1.0 in dev
```

Local Jaeger UI: `docker compose -f docker-compose.observability.yml up -d jaeger`
then http://localhost:16686.

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
5. Action Log tab → grab the `correlationId` of the affected user's last
   action; cross-reference with logs.
6. Escalate per `RUNBOOK.md` if the root cause isn't obvious in 10 min.

## Credentials reference

```
Grafana          admin / admin   (first-run, change immediately)
Bull Board       /admin/queues — Keycloak SSO, head/admin role only
Prometheus       no auth (corporate VPN gates external access)
```

## Pointers

- `RUNBOOK.md` — top 10 failure modes + rollback playbooks.
- `INCIDENT-PLAYBOOK.md` — on-call rotation + post-mortem template.
- `docs/DEPLOYMENT.md` — prod-stack diagram + Caddy/TLS topology.
- `deploy/log-sink/` — Vector + Promtail config for production log
  forwarding to the central SIEM.
