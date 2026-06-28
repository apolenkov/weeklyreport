## Context

`MetricsController` (`apps/api/src/infrastructure/metrics/metrics.controller.ts`)
exposes `GET /metrics` with no authentication guard — it returns raw Prometheus
text format to any caller. NestJS is not the problem; Caddy is the gate that
fails to close.

Both `deploy/caddy/Caddyfile` (production) and `deploy/caddy/Caddyfile.staging`
list `/metrics` inside the `@api` path matcher. Caddy reverse-proxies matching
requests to `api:3001` on the internal Docker network. Because this matcher sits
inside the public virtual host (`{$CADDY_SITE_ADDRESS}`), `/metrics` is reachable
from the internet with no credentials.

Local observability: `docker-compose.observability.yml` runs `grafana/otel-lgtm`
with a Prometheus job (`customreport-api`) targeting
`host.docker.internal:{API_PORT}/metrics`. That path goes Host → Docker port
mapping → `api:3001`, bypassing Caddy entirely. Removing `/metrics` from Caddy
does not affect this local scrape path.

Production observability: the repo comments note "the org typically has a managed
stack already"; no prod Prometheus config is present in the repo. Whether the
managed stack currently scrapes via the public domain or the internal network is
unknown (see § Open Questions).

## Goals / Non-Goals

**Goals:**

- Block unauthenticated access to `/metrics` from the public internet.
- Leave the Prometheus scrape path unaffected for any scraper that already
  targets the internal Docker network or host-mapped port.

**Non-Goals:**

- Adding a scrape-token, BasicAuth, or IP-allowlist guard inside
  `MetricsController` (defence-in-depth; tracked as a follow-up).
- Altering `deploy/prometheus-otel-lgtm.yml` or the local scrape job.
- Gating the endpoint at the NestJS application layer.

## Decisions

### Decision: Remove at Caddy, not at NestJS

**Choice**: Delete `/metrics` from the `@api` path list in both Caddyfiles.

**Rationale**: Prometheus already bypasses Caddy in the local setup via the
Docker host-mapped port. Enforcing at Caddy closes the public gap with a
one-line config edit; no TypeScript change, no dependency, no test delta in the
NestJS layer. Adding a guard to `MetricsController` is defence-in-depth and is a
follow-up, not a prerequisite.

**Alternatives considered**:

| Option                               | Trade-off                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Caddy basicauth block for `/metrics` | Requires storing credentials in Caddy config; Prometheus job would need credentials too; more moving parts. Valid as defence-in-depth but not the primary fix. |
| IP allowlist in Caddy                | Prometheus IP varies across managed stacks; brittle on cloud infra.                                                                                            |
| Guard in MetricsController           | Decouples from Caddy config; but adds NestJS code with no functional change for Prometheus (which bypasses the guard path anyway).                             |

### Decision: Fall-through to Next.js default handler

After removing `/metrics` from `@api`, a request for `/metrics` falls through to
Caddy's default `handle` block, which proxies to `web:3000` (Next.js). Next.js
has no `/metrics` route so it returns 404. This is acceptable: the response is
non-2xx and leaks no Prometheus data. An explicit Caddy `respond 404` block for
`/metrics` is cleaner but not required for security correctness.

## Risks / Trade-offs

- **Prod scraper via public domain** → If the managed Prometheus currently
  scrapes through the public edge URL (not the internal network), removing
  `/metrics` from `@api` silently breaks prod observability. Mitigation: confirm
  the prod scrape target before deploying (see § Open Questions). Rollback is a
  one-line Caddyfile edit + caddy reload.

- **Internal Docker network access remains open** → `MetricsController` has no
  guard; anything that can reach `api:3001` directly (another container on the
  same Docker network) can still scrape `/metrics`. This is the expected posture
  for a Prometheus scrape endpoint; the risk is low in a controlled Docker
  network.

## Migration Plan

1. Confirm the prod Prometheus scrape target is NOT the public domain (see
   § Open Questions); if it is, repoint it to the internal Docker network first.
2. Remove `/metrics` from the `@api` path matcher in `deploy/caddy/Caddyfile`.
3. Apply the same removal in `deploy/caddy/Caddyfile.staging`.
4. Update the route comment at the top of each Caddyfile.
5. Redeploy Caddy: `docker compose -f docker-compose.prod.yml up -d caddy` (or
   `caddy reload` in the running container).
6. Verify:
   - `curl -I https://{CADDY_SITE_ADDRESS}/metrics` returns a non-2xx status.
   - Prometheus scrape job `customreport-api` stays green (check Prometheus
     targets page or `curl http://localhost:{API_PORT}/metrics`).

**Rollback**: add `/metrics` back to `@api` in both Caddyfiles and reload Caddy.
No database change; no NestJS deploy needed.

## Open Questions

1. **Prod Prometheus scrape target**: does the managed observability stack
   currently scrape via the public domain URL or the internal Docker network?
   Must be answered before deploying to production. If scraping via the public
   domain, the managed stack's scrape config must be updated to use an
   internal-network address (e.g. `api:3001` from a container on the same
   network, or the host-mapped port if on the same host).
