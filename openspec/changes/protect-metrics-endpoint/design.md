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
with a Prometheus job (`customreport-api`) that pins
`host.docker.internal:3002/metrics` (`deploy/prometheus-otel-lgtm.yml`). That
matches the DEV api host port (dev compose maps `3002:3002`); the path goes Host
→ Docker port mapping → `api:3002`, bypassing Caddy entirely. Removing `/metrics`
from Caddy does not affect this dev scrape path. The pinned `3002` does NOT match
prod (`3001`), so layering this observability compose onto `docker-compose.prod.yml`
is a local convenience, NOT an authoritative prod scrape path — prod scraping is
the managed-stack open question below.

Production observability: the repo ships one prod-labelled scrape template,
`deploy/prometheus.yml` ("Prometheus scrape config for CustomReport prod
stack"). It is NOT mounted by any compose file — `docker-compose.observability.yml`
mounts `deploy/prometheus-otel-lgtm.yml` instead, and no other compose, script,
Makefile, or doc references `deploy/prometheus.yml`. It is a non-authoritative
template, not the live config. It also carries a stale target: its
`customreport-api` job points at `api:3002`, but the prod API listens on `3001`
(`env.schema.ts` `PORT` default `3001`; prod compose maps `${API_PORT:-3001}:3001`
and health-checks `:3001`; the `3002` in `Dockerfile.api` EXPOSE is itself stale).
Because this template targets an internal address (`api:3002`), it never scrapes
via the public domain, so it is not part of the public-exposure hole — but its
"prod" label plus stale port must be reconciled so it does not mislead operators
(see § Open Questions and tasks). Whether the actual managed stack scrapes via the
public domain or the internal network is still unknown (see § Open Questions).

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

### Decision: Host-port closure is delegated to ci-deploy-supplychain-hardening

**Choice**: Removing `/metrics` from Caddy is necessary but NOT sufficient.
`docker-compose.prod.yml` host-publishes the API container port
(`ports: "${API_PORT:-3001}:3001"`, binds `0.0.0.0:3001` by default). That host
port serves `/metrics` directly, bypassing Caddy entirely — so on a host with a
public IP and no firewall, `/metrics` stays reachable at
`http://<host>:3001/metrics` even after the Caddy edit. Full protection therefore
requires the host port to be closed.

**Ownership**: This change does NOT edit `docker-compose.prod.yml`. The host-port
closure (`ports:` → `expose:`, or a loopback bind) and its durable spec rule are
owned by the active `ci-deploy-supplychain-hardening` change — capability
`deploy-edge-topology`, requirement "The API is reachable only through the Caddy
edge". `protect-metrics-endpoint` depends on that requirement instead of
re-specifying it or editing the same file. See § Dependencies.

**Reconciliation with the local scrape requirement**: the host-port closure is
PROD-scoped (`docker-compose.prod.yml`). The local/dev observability scrape in
`docker-compose.observability.yml` reaches the dev api via the host-mapped port
(`host.docker.internal:3002`, dev compose `3002:3002`); that dev path stays
intact and is unaffected by the prod-scoped closure.

## Dependencies

- **[Dependency] `ci-deploy-supplychain-hardening` → `deploy-edge-topology`**
  (requirement "The API is reachable only through the Caddy edge"). That change
  is authoritative for switching the `api` service in `docker-compose.prod.yml`
  from host-published `ports:` to `expose:` (or a loopback bind), and owns the
  durable host-port rule. `protect-metrics-endpoint` removes `/metrics` from the
  public Caddy matcher; the host-port closure is the prerequisite that makes that
  removal complete (otherwise `/metrics` is still reachable on the public host
  port). Ordering: `deploy-edge-topology`'s host-port closure MUST land before or
  alongside this change for full protection in prod. This change does not edit
  `docker-compose.prod.yml` or re-specify that rule.

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
