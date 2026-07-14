## 1. BL-22 base: exporter/scrape parity, no silent Grafana default, digest pins

- [ ] 1.1 `docker-compose.observability.yml`: change `postgres-exporter`'s
      `DATA_SOURCE_NAME` to read the DB name from a `${POSTGRES_DB:?...}`-style
      var instead of the hardcoded `customreport_dev`, matching the pattern
      `docker-compose.prod.yml` uses for its own required vars
- [ ] 1.2 `docker-compose.observability.yml`: change
      `GF_SECURITY_ADMIN_PASSWORD` from `${GRAFANA_ADMIN_PASSWORD:-admin}` to
      `${GRAFANA_ADMIN_PASSWORD:?GRAFANA_ADMIN_PASSWORD must be set}` (no
      silent default, matching the repo's `env.schema.ts` convention)
- [ ] 1.3 `deploy/prometheus-otel-lgtm.yml`: add a second `customreport-api`
      scrape target (or a documented override) that resolves against the
      prod compose network (`api:3001`) instead of only
      `host.docker.internal:3002`, so a prod-layered observability run
      actually scrapes `/metrics`
- [ ] 1.4 `docker-compose.observability.yml`: digest-pin
      `grafana/otel-lgtm:latest`, `prometheuscommunity/postgres-exporter:v0.15.0`,
      `oliver006/redis_exporter:v1.62.0` to their current published digests
- [ ] 1.5 `docker-compose.yml`: digest-pin `axllent/mailpit:latest`
- [ ] 1.6 `docker-compose.errors.yml`: digest-pin `bugsink/bugsink:latest`
- [ ] 1.7 `docker-compose.observability.yml`: bind `otel-lgtm`'s published
      ports to loopback — `127.0.0.1:${GRAFANA_PORT:-3003}:3000`,
      `127.0.0.1:4317:4317`, `127.0.0.1:4318:4318`, `127.0.0.1:9090:9090` —
      so a prod-layered observability run doesn't expose Grafana/OTLP/Prom
      to the public network interface
- [ ] 1.8 Open-verification (Redis `requirepass`): trace every
      Redis-touching env var (`REDIS_URL`/`REDIS_HOST`/`REDIS_PORT`/any
      `REDIS_PASSWORD`) across `docker-compose.prod.yml`, `env.schema.ts`,
      and any `.env.prod.example` in the repo. If the trace confirms no
      password path exists anywhere, record the finding and open a
      follow-up change rather than silently patching it in here (out of
      this change's confirmed scope per the review's disposition)
- [ ] 1.9 `docker compose -f docker-compose.yml -f docker-compose.observability.yml config` parses clean
- [ ] 1.10 Boot smoke: `docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.observability.yml up -d`, confirm `postgres-exporter` and `otel-lgtm` report healthy, confirm Grafana refuses to boot (or errors loud) when `GRAFANA_ADMIN_PASSWORD` is unset

## 2. GitHub Actions: pin to SHAs

- [ ] 2.1 `.github/workflows/ci.yml`: pin `actions/checkout@v4` (lines 36,
      150, 236, 317, 369) to the current `v4` tag's commit SHA, trailing
      comment `# v4`
- [ ] 2.2 `.github/workflows/ci.yml`: pin `actions/setup-node@v4` (lines 39,
      153, 239, 320) the same way
- [ ] 2.3 `.github/workflows/ci.yml`: pin `actions/upload-artifact@v4`
      (lines 70, 93, 188, 196, 352) the same way
- [ ] 2.4 Validate `ci.yml` YAML syntax (`actionlint .github/workflows/ci.yml`
      if available, else a manual YAML parse) after the edits

## 3. Staging Caddyfile: CSP parity with prod (closes an existing spec violation)

`openspec/specs/deploy-caddy-config/spec.md`'s "Staging and prod Caddyfiles
carry matching security-header floors" requirement already mandates this;
`Caddyfile.staging`'s current CSP is a live violation of that spec, not new
spec surface — this slice is a pure bug fix, no `specs/` delta needed.

- [ ] 3.1 `deploy/caddy/Caddyfile.staging`: add `script-src 'self'
'unsafe-inline'` to the `Content-Security-Policy-Report-Only` header,
      matching prod's `script-src` directive
- [ ] 3.2 `deploy/caddy/Caddyfile.staging`: add `font-src 'self'
https://fonts.gstatic.com` and extend `style-src` with
      `https://fonts.googleapis.com`, matching prod
- [ ] 3.3 Keep the header name `Content-Security-Policy-Report-Only` (not
      enforcing) — staging's role is prod-policy rehearsal without live
      enforcement risk; do not flip to enforcing in this change
- [ ] 3.4 Real-browser verification: mount `Caddyfile.staging` against a
      running prod-mode stack, load every top-level role route (lead, head,
      admin, viewer) in an actual browser, open DevTools Console + Network,
      confirm zero CSP-Report-Only violations reported that prod's enforcing
      policy would also not block, and confirm the app hydrates cleanly

## 4. Alertmanager webhook: verify receiver, then correct

- [ ] 4.1 Re-grep `apps/api/src` for `api/alerts` / `/alerts` route
      definitions to confirm no receiver exists (already checked clean at
      proposal time; re-check in case a change since then added one)
- [ ] 4.2 Confirm the correct prod API port from `docker-compose.prod.yml`
      (`PORT: 3001`, `expose: [3001]`) as the target port
- [ ] 4.3 If no receiver exists (expected outcome per 4.1): update
      `deploy/alertmanager.yml`'s webhook URL to the correct port
      (`http://api:3001/api/alerts`) and strengthen the existing stub
      comment to make explicit the endpoint is not yet implemented and
      alerting must not be activated until it is
- [ ] 4.4 If a receiver does exist by implementation time (unexpected):
      update both the port and the endpoint path to match the real route
- [ ] 4.5 `docker compose -f docker-compose.prod.yml -f docker-compose.observability.yml config` parses clean
- [ ] 4.6 Manual reachability check: from inside the compose network,
      confirm `api:3001` is listening (e.g.
      `docker compose exec alertmanager wget -qO- http://api:3001/health/ready`)
      as a stand-in for the still-stubbed `/api/alerts` route

## 5. Gates

- [ ] 5.1 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.2 `openspec validate deploy-config-parity --strict`
