## 1. Pre-deploy verification

- [ ] 1.1 Confirm that the production Prometheus (or managed observability stack) scrape target for `customreport-api` uses an internal-network address, NOT the public `{CADDY_SITE_ADDRESS}` domain; document the finding before proceeding.
- [ ] 1.2 If the managed scraper currently uses the public domain, update its scrape config to target `api:3001` via the internal Docker network (or the host-mapped port), and verify the Prometheus target shows UP before editing Caddy.

## 2. Caddyfile changes

- [ ] 2.1 In `deploy/caddy/Caddyfile`: remove `/metrics` from the `path` directive inside the `@api` matcher block.
- [ ] 2.2 In `deploy/caddy/Caddyfile`: update the route comment at the top (the `# Routes:` section) to remove `/metrics` from the listed paths.
- [ ] 2.3 In `deploy/caddy/Caddyfile.staging`: apply the same removal from the `@api` matcher `path` directive.
- [ ] 2.4 In `deploy/caddy/Caddyfile.staging`: update the route comment to reflect the removal.

## 3. Deployment and verification

- [ ] 3.1 Reload or redeploy Caddy: `docker compose -f docker-compose.prod.yml up -d caddy` (or `docker exec <caddy> caddy reload --config /etc/caddy/Caddyfile`).
- [ ] 3.2 Verify the public endpoint is blocked: `curl -o /dev/null -s -w "%{http_code}" https://{CADDY_SITE_ADDRESS}/metrics` must return a non-2xx code.
- [ ] 3.3 Verify internal scrape still works: `curl -s http://localhost:{API_PORT}/metrics | grep "# HELP"` must return Prometheus metric families.
- [ ] 3.4 Confirm the Prometheus scrape job `customreport-api` reports `UP` on the Prometheus targets page (or equivalent in the managed stack).

## 4. Gates

- [ ] 4.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all gates must remain green (no code changes expected; this is a config-only edit).
- [ ] 4.2 Run `openspec validate "protect-metrics-endpoint" --strict` — must exit 0.
