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
- `apps/api/src/infrastructure/metrics/metrics.controller.ts` — no changes.
- `deploy/prometheus-otel-lgtm.yml` — no changes (local scrape path already bypasses Caddy).
- Prod Prometheus scrape config (managed stack, outside repo) — must be verified to target the API via the internal Docker network, not the public domain; see design.md § Open Questions.
