## 1. Pre-deploy verification

- [ ] 1.1 Confirm that the production Prometheus (or managed observability stack) scrape target for `customreport-api` uses an internal-network address, NOT the public `{CADDY_SITE_ADDRESS}` domain; document the finding before proceeding.
- [ ] 1.2 If the managed scraper currently uses the public domain, update its scrape config to target `api:3001` via the internal Docker network (or a loopback-bound host port), and verify the Prometheus target shows UP before editing Caddy.
- [ ] 1.3 Reconcile `deploy/prometheus.yml` (prod-labelled scrape template, wired into no compose file, stale `api:3002` target): either repoint its `customreport-api` target to `api:3001`, or add a top comment marking the file non-authoritative so it cannot mislead operators about the live scrape config.

## 2. Caddyfile changes

- [ ] 2.1 In `deploy/caddy/Caddyfile`: remove `/metrics` from the `path` directive inside the `@api` matcher block.
- [ ] 2.2 In `deploy/caddy/Caddyfile`: update the route comment at the top (the `# Routes:` section) to remove `/metrics` from the listed paths.
- [ ] 2.3 In `deploy/caddy/Caddyfile.staging`: apply the same removal from the `@api` matcher `path` directive.
- [ ] 2.4 In `deploy/caddy/Caddyfile.staging`: update the route comment to reflect the removal.

## 3. Confirm the prod host-port closure (DEPENDENCY — owned by `ci-deploy-supplychain-hardening`)

- [ ] 3.1 Do NOT edit `docker-compose.prod.yml` in this change. Confirm the `api` host-port closure (`ports:` → `expose:`, or a loopback bind) from `ci-deploy-supplychain-hardening`'s `deploy-edge-topology` requirement ("The API is reachable only through the Caddy edge") has landed or is co-deployed; otherwise `/metrics` stays reachable on the public host port and this change is incomplete. See design.md § Dependencies.
- [ ] 3.2 If that closure used a loopback bind instead of `expose`, confirm the firewall rule proving port `3001` is not reachable from outside the host exists (owned and documented by the dependency change).
- [ ] 3.3 Confirm this change is prod-scoped only: the dev `docker-compose.observability.yml` scrape via `host.docker.internal:3002` (dev compose maps `3002:3002`) must remain intact.

## 4. Deployment and verification

- [ ] 4.1 Reload or redeploy Caddy: `docker compose -f docker-compose.prod.yml up -d caddy` (or `docker exec <caddy> caddy reload --config /etc/caddy/Caddyfile`).
- [ ] 4.2 Verify the public endpoint is blocked: `curl -o /dev/null -s -w "%{http_code}" https://{CADDY_SITE_ADDRESS}/metrics` must return a non-2xx code.
- [ ] 4.3 Verify the host-port bypass is closed: from outside the prod host, `curl http://<prod-host-public-ip>:{API_PORT}/metrics` must NOT return Prometheus text (connection refused/filtered or no `# HELP`).
- [ ] 4.4 Verify internal scrape still works: `curl -s http://localhost:{API_PORT}/metrics | grep "# HELP"` must return Prometheus metric families (run from the host loopback or a container on the Docker network, per the chosen option).
- [ ] 4.5 Confirm the Prometheus scrape job `customreport-api` reports `UP` on the Prometheus targets page (or equivalent in the managed stack).

## 5. Gates

- [ ] 5.1 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all gates must remain green (no application code changes expected; this is a config-only edit).
- [ ] 5.2 Run `openspec validate "protect-metrics-endpoint" --strict` — must exit 0.
