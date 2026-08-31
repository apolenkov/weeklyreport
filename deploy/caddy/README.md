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

## Verifying

After `docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d`:

```bash
# API reachability only (inside the Docker network; this does not prove the
# host-bound Caddy site or its TLS/SNI routing):
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy wget -q --spider http://localhost/health/live

# Edge proof: substitute the exact host from CADDY_SITE_ADDRESS and the public
# IP returned by DNS. The hostname in the URL supplies SNI; --resolve keeps the
# request on the intended edge while preserving that host for Caddy routing.
SITE_HOST=customreport.example.com
PUBLIC_IP=203.0.113.10
curl --fail --resolve "${SITE_HOST}:443:${PUBLIC_IP}" "https://${SITE_HOST}/health/live"   # 200: API process is running; dependencies are not checked
curl --fail --resolve "${SITE_HOST}:443:${PUBLIC_IP}" "https://${SITE_HOST}/health/ready"  # 200 only when DB, Redis, BullMQ, and heap checks pass
curl --fail --head --resolve "${SITE_HOST}:443:${PUBLIC_IP}" "https://${SITE_HOST}/"            # 200 from web
```

## Rotating Let's Encrypt certs

Caddy renews automatically ~30 days before expiry. To force a renewal:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```
