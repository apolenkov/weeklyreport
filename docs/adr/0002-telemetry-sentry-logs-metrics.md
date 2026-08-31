---
status: accepted
---

# Errors use external Sentry; logs and metrics stay application-owned

WeeklyReport keeps operational signals small and explicit:

- API and Web errors go to the configured external Sentry project;
- the API writes structured logs with request correlation fields;
- the API exposes internal metrics at `/metrics`;
- production Caddy keeps `/metrics` off the public edge.

The repository includes an optional observability Compose overlay for local and
production-like diagnosis. It starts Grafana, Loki, Tempo, Prometheus, the OTel
Collector, and the repository-owned dashboards, but it is not part of the
default production Compose stack. Production may connect the same application
signals to an operator-managed platform instead.

The application remains useful with Sentry and the optional overlay disabled:
structured logs, health endpoints, and internal metrics still support local
diagnosis and production operations.
