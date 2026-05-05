# Phase 38, Plan 02 — SUMMARY

**REQ-IDs:** INF-02
**Status:** complete

## What shipped

- `deploy/caddy/Caddyfile` — production reverse-proxy with auto-HTTPS via Let's Encrypt. Routes `/trpc`, `/auth`, `/health`, `/metrics`, `/admin/queues` to `api:3001`; everything else to `web:3000`. Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP report-only). zstd+gzip encoding. Long timeouts (5m read/write) for SSE / future tRPC subscriptions. WebSocket upgrade is automatic in caddy v2 — no directive needed.
- `deploy/caddy/Caddyfile.staging` — same routes with `tls internal` for staging / air-gapped / LE rate-limited environments. Documented in README how to mount it instead of the prod Caddyfile.
- `deploy/caddy/README.md` — env-var reference (`CADDY_SITE_ADDRESS`, `CADDY_ACME_EMAIL`), route table, verification commands, cert rotation, staging CA trust steps.
- `docker-compose.prod.yml` — added `caddy` service (`caddy:2.8-alpine`), bind-mounts `Caddyfile`, persists `caddy_data` + `caddy_config` volumes (LE certs survive container restart). Exposes :80 + :443/tcp + :443/udp (HTTP/3). `depends_on` api+web healthy. Healthcheck via caddy admin API (`:2019/config/`). Memory limit 256M. Web's host port :3000 mapping commented out — caddy is now the only inbound path.

## Verification (deferred — needs prod stack running)

```bash
# Boot prod stack
DB_PASSWORD=pw AUTH_JWT_SECRET=$(openssl rand -hex 32) \
PDF_EXPORT_JWT_SECRET=$(openssl rand -hex 16) \
SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_FROM=ops@example.com \
KEYCLOAK_SAML_CALLBACK_URL=https://example.com/auth/saml/callback \
KEYCLOAK_SAML_ENTRY_POINT=https://kc.example.com/realms/example/protocol/saml \
KEYCLOAK_SAML_ISSUER=customreport \
KEYCLOAK_SAML_CERT="$(cat saml.crt)" \
FRONTEND_URL=https://customreport.example.com \
CADDY_SITE_ADDRESS=customreport.example.com \
CADDY_ACME_EMAIL=ops@example.com \
docker compose -f docker-compose.prod.yml up -d

# Inside the docker network
docker compose -f docker-compose.prod.yml exec caddy curl -I http://localhost/health/live
# expect 200 from api

# From a host that resolves CADDY_SITE_ADDRESS
curl -I https://customreport.example.com/         # 200 from web
curl -I https://customreport.example.com/health   # 200 from api
```

For air-gapped / LE-rate-limited environments, swap the Caddyfile mount in
`docker-compose.prod.yml` to point at `deploy/caddy/Caddyfile.staging` (or use
a `docker-compose.override.yml` that re-binds the volume).

## Files

- `deploy/caddy/Caddyfile` (new)
- `deploy/caddy/Caddyfile.staging` (new)
- `deploy/caddy/README.md` (new)
- `docker-compose.prod.yml` (web port → expose-only; caddy service + caddy_data/caddy_config volumes added)
