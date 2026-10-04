---
status: accepted
date: 2026-08-30
---

# Errors use external Sentry; logs and metrics stay application-owned

WeeklyReport keeps operational signals small and explicit:

- API and Web errors go to the configured external Sentry project;
- the API writes structured logs with request correlation fields;
- the API exposes internal metrics at `/metrics`;
- production Caddy keeps `/metrics` off the public edge.

The repository keeps the Grafana dashboards and Prometheus alert rules under
`deploy/helm/weeklyreport/observability/` as DevOps reference material (the
former local Compose overlay with Grafana, Loki, Tempo and the OTel Collector
was removed on 2026-10-04). They are not part of the production Helm chart.
Production connects the same application signals to an
operator-managed platform.

The application remains useful with Sentry and the optional overlay disabled:
structured logs, health endpoints, and internal metrics still support local
diagnosis and production operations.
