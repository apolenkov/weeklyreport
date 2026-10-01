# WeeklyReport Helm chart

Helm chart for the production stack on Kubernetes. Install, upgrade, rollback,
secrets, and recovery are documented in [`docs/kubernetes.md`](../../../docs/kubernetes.md).
Names are fixed (`api`, `web`, `gotenberg`, `postgres`, `pgbouncer`, `redis`, `edge`) because the web
image bakes `http://api:3001`, so install **one release per namespace**.

## Edge (Caddy)

`files/Caddyfile` (in this chart directory) is the single deployment configuration, mounted by
`docker-compose.prod.yml` and by the chart's `edge` Deployment. The chart edge serves plain HTTP
(`http://:8080`) behind the cluster Ingress, which owns TLS, and resolves the client address
through `CADDY_TRUSTED_PROXIES`. `/metrics` stays internal. CSP violation reports go to
`CADDY_CSP_REPORT_URI`, an external operator-owned collector; the repository does not implement one.

## Routes

```
/api/web-vitals*, /api/client-logs*                       ->  api:3001
/trpc/*, /auth/*, /health/*, /admin/queues/*, /pdfs/*     ->  api:3001
/metrics, /metrics/*                                      ->  404 at the public edge
/  (everything else)                                     ->  web:3000
```

An operator-owned metrics collector can scrape `api:3001/metrics` inside the cluster.
