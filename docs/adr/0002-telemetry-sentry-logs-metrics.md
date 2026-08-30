---
status: accepted
---

# Errors use external Sentry; logs and metrics stay application-owned

WeeklyReport keeps operational signals small and explicit:

- API and Web errors go to the configured external Sentry project;
- the API writes structured logs with request correlation fields;
- the API exposes internal metrics at `/metrics`;
- production Caddy keeps `/metrics` off the public edge.

There is no repository-owned telemetry collector or local dashboard stack. The
application remains useful with Sentry disabled: structured logs, health
endpoints, and internal metrics still support local diagnosis and production
operations.
