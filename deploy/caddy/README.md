# Caddy reverse-proxy

Edge service that terminates TLS, fans out HTTP traffic to the api/web
containers, and adds security headers.

## Files

| File                | When to use                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Caddyfile`         | Production. Auto-HTTPS via Let's Encrypt; needs `CADDY_SITE_ADDRESS` set to a publicly resolvable hostname and `CADDY_ACME_EMAIL` for cert notifications. `/metrics` stays internal. |
| `Caddyfile.staging` | Staging / air-gapped / LE rate-limited. Uses caddy's built-in CA (`tls internal`).                                                                                                   |

## Required env vars (in `.env.production`)

```bash
CADDY_SITE_ADDRESS=customreport.example.com   # or http://customreport.example.com for HTTP-only
CADDY_ACME_EMAIL=ops@example.com
```

`CADDY_SITE_ADDRESS` accepts:

- `customreport.example.com` → auto-HTTPS via Let's Encrypt
- `https://customreport.example.com` → same as above, explicit scheme
- `http://customreport.example.com` → HTTP-only (no TLS, useful behind another LB)
- `localhost`, `*.local` → caddy's internal CA (no LE call attempted)

## Routes

```
/trpc/*, /auth/*, /health/*, /admin/queues/*             ->  api:3001
/metrics, /metrics/*                                     ->  404 at the public edge
/  (everything else)                                    ->  web:3000
```

Prometheus scrapes `api:3001/metrics` over the internal Compose network.

WebSocket upgrade is automatic for tRPC subscriptions when those land — caddy
forwards `Upgrade: websocket` headers without configuration.

## Verifying

After `docker compose --env-file .env.production -f docker-compose.prod.yml up -d`:

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

## Trust the staging CA

For `Caddyfile.staging` (caddy internal CA), browsers will warn until the root
is trusted. Pull the root and import it on the client:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy \
  cat /data/caddy/pki/authorities/local/root.crt > caddy-staging-root.crt
# Then import caddy-staging-root.crt into your OS / browser trust store.
```
