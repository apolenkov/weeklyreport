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
- Close the prod host-port bypass — DEPENDENCY, not owned here: removing
  `/metrics` from Caddy is insufficient while `docker-compose.prod.yml`
  host-publishes the API port (`ports: "${API_PORT:-3001}:3001"`, binds
  `0.0.0.0`), which serves `/metrics` directly past Caddy. The host-port closure
  (`ports:` → `expose:`) and its durable rule are owned by the active
  `ci-deploy-supplychain-hardening` change (`deploy-edge-topology`). This change
  does NOT edit `docker-compose.prod.yml`; it depends on that change landing or
  being co-deployed. See design.md § Dependencies.
- Reconcile `deploy/prometheus.yml`: it is a prod-labelled scrape template wired
  into no compose file, with a stale `api:3002` target (prod API listens on
  `3001`). Either repoint its target to `api:3001` or mark it explicitly
  non-authoritative, so it does not mislead operators.
- `MetricsController` itself is unchanged; no NestJS code changes.
- No changes to `deploy/prometheus-otel-lgtm.yml` — the local/dev otel-lgtm
  scrape job. It pins `host.docker.internal:3002`, which matches the DEV api host
  port (dev compose maps `3002:3002`), not prod (`3001`). Layering
  `docker-compose.observability.yml` onto `docker-compose.prod.yml` is a local
  convenience, NOT an authoritative prod scrape path; prod scraping is governed
  by the managed-stack open question (see design.md).

**Non-goals**

- Adding a scrape-token or BasicAuth guard inside `MetricsController` (valid
  defence-in-depth; tracked separately as a follow-up).
- Changing `deploy/prometheus-otel-lgtm.yml`, the local/dev otel-lgtm scrape job
  (its job names, intervals, or its pinned `host.docker.internal:3002` target).
  Reconciling `deploy/prometheus.yml` and verifying the managed prod scraper IS
  in scope (see What Changes and tasks).
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
- `docker-compose.prod.yml` — NOT edited by this change. The host-port closure
  (`ports:` → `expose:`) is owned by `ci-deploy-supplychain-hardening`
  (`deploy-edge-topology`); this change depends on it. See design.md § Dependencies.
- `deploy/prometheus.yml` — repoint the `customreport-api` target to `api:3001` or
  mark the file non-authoritative; it is a prod-labelled template wired nowhere.
- `apps/api/src/infrastructure/metrics/metrics.controller.ts` — no changes.
- `deploy/prometheus-otel-lgtm.yml` — no changes (dev-only otel-lgtm scrape, pinned to `host.docker.internal:3002`; bypasses Caddy).
- Prod Prometheus scrape config (managed stack, outside repo) — must be verified to target the API via the internal Docker network, not the public domain; see design.md § Open Questions.
