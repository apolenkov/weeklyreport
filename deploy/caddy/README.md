# Caddy reverse-proxy

Edge service that terminates TLS, fans out HTTP traffic to the api/web
containers, and adds security headers.

`Caddyfile` is the single deployment configuration. It provides automatic HTTPS
for a publicly resolvable `CADDY_SITE_ADDRESS`; `/metrics` stays internal.

## Required env vars (in `.env.production`)

```bash
CADDY_SITE_ADDRESS=customreport.example.com   # or http://customreport.example.com for HTTP-only
CADDY_ACME_EMAIL=ops@example.com
CADDY_CSP_REPORT_URI=https://csp-reports.example.net/customreport
```

The production Compose contract also requires `HTTP_PORT`, `HTTPS_PORT`, and
`HTTPS_PORT_QUIC`. See
[`production.env.example`](../environment/production.env.example)
for the complete names-only template. `CADDY_CSP_REPORT_URI` must point to an
external operator-owned collector; the repository does not implement a local
CSP-report endpoint.

`CADDY_SITE_ADDRESS` accepts:

- `customreport.example.com` → auto-HTTPS via Let's Encrypt
- `https://customreport.example.com` → same as above, explicit scheme
- `http://customreport.example.com` → HTTP-only (no TLS, useful behind another LB)
- `localhost`, `*.local` → caddy's internal CA (no LE call attempted)

## Routes

```
/api/web-vitals*, /api/client-logs*                       ->  api:3001
/trpc/*, /auth/*, /health/*, /admin/queues/*, /pdfs/*     ->  api:3001
/metrics, /metrics/*                                      ->  404 at the public edge
/  (everything else)                                     ->  web:3000
```

An operator-owned metrics collector can scrape `api:3001/metrics` over the
internal Compose network.

WebSocket upgrade is automatic for tRPC subscriptions when those land — caddy
forwards `Upgrade: websocket` headers without configuration.

## Verifying

After `docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d`:

```bash
# Inside the docker network (the pinned Caddy image provides wget):
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy wget -q --spider http://localhost/health/live

# From a host that resolves CADDY_SITE_ADDRESS:
curl -I https://customreport.example.com/health/live
curl -I https://customreport.example.com/             # 200 from web
curl -I https://customreport.example.com/trpc/health  # 200 from api
```

## Rotating Let's Encrypt certs

Caddy renews automatically ~30 days before expiry. To force a renewal:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```
