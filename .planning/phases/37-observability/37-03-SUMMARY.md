# Phase 37, Plan 03 — SUMMARY

**REQ-IDs:** OBS-03
**Status:** complete

## What shipped

- `deploy/prometheus.yml` — scrape config with three jobs (customreport-api at 15s, postgres-exporter at 30s, redis-exporter at 30s; latter two commented if exporters absent). External label `cluster: customreport-prod`.
- `deploy/grafana/customreport-dashboard.json` — 5-panel skeleton:
  1. HTTP request rate (req/s) by route + status_code
  2. HTTP p95 latency by route (histogram_quantile over `_bucket`)
  3. BullMQ DLQ failed total (stat with green/yellow/red thresholds at 0/1/5)
  4. Login attempts rate by outcome (relies on `cr_login_attempts_total` — provided by 37-02)
  5. Rate-limit hits by bucket (relies on `cr_rate_limit_hits_total` — already in 36-01)
- `docker-compose.observability.yml` — Prometheus 2.51 + Grafana 10.4 + named volumes. Composes alongside docker-compose.prod.yml via `-f` chain. 30-day Prom retention. Grafana auto-loads dashboard from `/var/lib/grafana/dashboards/`.

## Verification (deferred)

Manual smoke needs `docker compose -f docker-compose.prod.yml -f docker-compose.observability.yml up -d`. Then:

1. Visit `http://localhost:9090/targets` — all api/postgres-exporter/redis-exporter targets UP
2. Visit `http://localhost:3001` (Grafana) — log in admin/admin, see "CustomReport — Operational Dashboard"
3. All 5 panels render data (some empty until cr_dlq_failed_total / cr_login_attempts_total counters fire)

## Files

- `deploy/prometheus.yml` (new)
- `deploy/grafana/customreport-dashboard.json` (new)
- `docker-compose.observability.yml` (new)
