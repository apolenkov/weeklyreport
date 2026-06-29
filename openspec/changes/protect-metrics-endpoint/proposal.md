## Why

The `/metrics` Prometheus endpoint is reachable by any anonymous caller on the
public domain. Caddy's `@api` matcher routes `/metrics` to `api:3001` with no
authentication, allowlist, or edge block. Any internet scanner can read
`cr_login_attempts_total`, rate-limit hit counts, report KPI gauges, reopen
request counters, and internal tRPC route names — aggregate information
disclosure with no credentials required. The fix is a one-line Caddy config
change; deferring it is risk without cost.

## What Changes

- Remove `/metrics` from the `@api` path matcher in `deploy/caddy/Caddyfile`
  and `deploy/caddy/Caddyfile.staging`; after this change Caddy returns a
  non-2xx response for any request to `/metrics` on the public domain.
- Update the route comment at the top of each Caddyfile to reflect the removal.
- Close the prod host-port bypass: `docker-compose.prod.yml` publishes the API
  container port to the host (`ports: "${API_PORT:-3001}:3001"`, binds
  `0.0.0.0`), which serves `/metrics` directly past Caddy. Make this non-public —
  drop the host `ports` mapping in favour of `expose` (preferred, matches the
  `web` service precedent), or bind to `127.0.0.1` with firewall proof. Choice
  follows the prod scrape-path open question.
- Reconcile `deploy/prometheus.yml`: it is a prod-labelled scrape template wired
  into no compose file, with a stale `api:3002` target (prod API listens on
  `3001`). Either repoint its target to `api:3001` or mark it explicitly
  non-authoritative, so it does not mislead operators.
- `MetricsController` itself is unchanged; no NestJS code changes.
- No changes to `deploy/prometheus-otel-lgtm.yml`; authorized scrapers continue
  to reach the API via a network path that bypasses Caddy (see design.md for
  prod scraping open question).

**Non-goals**

- Adding a scrape-token or BasicAuth guard inside `MetricsController` (valid
  defence-in-depth; tracked separately as a follow-up).
- Changing the Prometheus scrape target, port, or job configuration.
- Restricting `/metrics` at the NestJS application layer.

## Capabilities

### New Capabilities

- `metrics-scrape-access-control`: governs which network paths may reach the
  `/metrics` Prometheus scrape endpoint and prohibits public-edge exposure.

### Modified Capabilities

<!-- none — no existing spec governs metrics endpoint access -->

## Impact

- `deploy/caddy/Caddyfile` — remove `/metrics` from `@api` path list; update comment.
- `deploy/caddy/Caddyfile.staging` — same change.
- `docker-compose.prod.yml` — make the host-published API port non-public (drop the
  `ports` mapping for `api` in favour of `expose`, or bind to `127.0.0.1`), so
  `/metrics` is not reachable on the host's public interface past Caddy.
- `deploy/prometheus.yml` — repoint the `customreport-api` target to `api:3001` or
  mark the file non-authoritative; it is a prod-labelled template wired nowhere.
- `apps/api/src/infrastructure/metrics/metrics.controller.ts` — no changes.
- `deploy/prometheus-otel-lgtm.yml` — no changes (local scrape path already bypasses Caddy).
- Prod Prometheus scrape config (managed stack, outside repo) — must be verified to target the API via the internal Docker network, not the public domain; see design.md § Open Questions.
