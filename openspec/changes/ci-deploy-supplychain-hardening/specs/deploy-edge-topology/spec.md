## ADDED Requirements

### Requirement: The API image declared port matches its runtime port

`Dockerfile.api` SHALL `EXPOSE` and run its baked `HEALTHCHECK` against the same
port the API binds at runtime (`3001`), so a plain `docker run` or a
baked-healthcheck orchestrator does not report the container permanently
unhealthy. The `EXPOSE` and `HEALTHCHECK` MUST either both use `3001` or both be
parameterized via the `PORT` environment variable using the same default the
application reads, rather than the current hardcoded `3002`.

#### Scenario: Standalone container reports healthy

- **GIVEN** the API image built from the updated `Dockerfile.api`
- **WHEN** the image is run standalone (no compose healthcheck override) and the
  API has started
- **THEN** the baked `HEALTHCHECK` probes the port the API actually binds and
  reports the container healthy

#### Scenario: No residual 3002 mismatch

- **GIVEN** the updated `Dockerfile.api`
- **WHEN** the `EXPOSE` and `HEALTHCHECK` lines are inspected
- **THEN** they reference `3001` (or `PORT` with the runtime default), and do
  not hardcode `3002` while the API binds `3001`

### Requirement: The API is reachable only through the Caddy edge

The `api` service in `docker-compose.prod.yml` SHALL be expose-only (or bound to
localhost), not host-published, so all external traffic flows through the Caddy
edge and its TLS/header controls, matching the expose-only posture already
applied to the `web` service. The host-publishing
`ports: ["${API_PORT:-3001}:3001"]` MUST be replaced with `expose: ["3001"]`
(or a `127.0.0.1`-bound publish) unless direct host access is an intentional,
documented ops need.

#### Scenario: API has no public host port in prod compose

- **GIVEN** the updated `docker-compose.prod.yml`
- **WHEN** the `api` service networking is inspected
- **THEN** it declares `expose: ["3001"]` (or a localhost-only bind) and no
  `0.0.0.0` host-published `ports:` entry, while Caddy still reverse-proxies to
  `api:3001` over the compose network

#### Scenario: A remote caller cannot bypass the edge (expose-only)

- **GIVEN** the API running under the updated prod compose with `expose: ["3001"]`
- **WHEN** any caller attempts to reach the API directly on a host interface
  outside the Caddy hop
- **THEN** no host port is published at all, so the API socket is unreachable
  from the host and from any remote machine, and the edge TLS and header
  controls cannot be bypassed

#### Scenario: A remote caller cannot bypass the edge (localhost-bound option)

- **GIVEN** the API running under the updated prod compose with a
  `127.0.0.1`-bound publish, chosen for a documented ops need
- **WHEN** a remote caller on another machine attempts to reach the API directly
  on a host interface outside the Caddy hop
- **THEN** the published port is bound only to loopback, so it is unreachable
  from any non-loopback interface and the edge controls cannot be bypassed from
  another machine — host-local processes can still reach loopback, which is the
  accepted trade-off of this option versus `expose:`

#### Scenario: Trust-proxy prerequisite is satisfied

- **GIVEN** the `set-express-trust-proxy` change requires the API host port
  closed before enabling `trust proxy` in production (its `BL-DEPLOY-SEAM-MISC`
  prerequisite)
- **WHEN** this change makes the `api` service expose-only
- **THEN** the prerequisite is satisfied: an attacker can no longer reach the
  Express socket outside the Caddy hop to forge `X-Forwarded-For`

### Requirement: The production web image bakes an edge-safe API URL default

`Dockerfile.web` SHALL NOT bake an API URL default that points at the API host
port this change removes (`http://localhost:3002`), so the production web image
does not ship the browser a dead direct-to-host API path once the `api` service
is expose-only. Because `NEXT_PUBLIC_*` values are inlined into the client bundle
at build time, the `NEXT_PUBLIC_API_URL` alignment MUST happen at build (the
`Dockerfile.web` `ARG`/`ENV` default or a `web.build.args` entry in
`docker-compose.prod.yml`), not via runtime `web.environment`, which cannot
change an already-inlined client value. The server-side `API_URL` default MUST
target `http://api:3001` over the compose network (matching the runtime
`web.environment` override), and the client-facing `NEXT_PUBLIC_API_URL` MUST
reach the API through the Caddy edge (same-origin / public site address), not the
removed host port; neither default may remain `:3002`.

#### Scenario: Web build args do not target the removed host port

- **GIVEN** the updated `Dockerfile.web`
- **WHEN** the builder-stage `ARG`/`ENV` API URL defaults are inspected
- **THEN** `API_URL` defaults to `http://api:3001` (the compose-network API) and
  `NEXT_PUBLIC_API_URL` does not default to `http://localhost:3002`, so the baked
  client bundle has no direct-to-host API path that the expose-only `api` service
  no longer serves

#### Scenario: Client API URL is aligned at build, not via no-op runtime env

- **GIVEN** the production web image and `docker-compose.prod.yml`
- **WHEN** `NEXT_PUBLIC_API_URL` is set
- **THEN** it is supplied at build (the `Dockerfile.web` default or a
  `web.build.args` entry), because the runtime `web.environment:
NEXT_PUBLIC_API_URL` line cannot override the already-inlined client value, and
  the resolved client path reaches the API through the Caddy edge rather than the
  removed `:3002` host port

#### Scenario: Web build alignment precedes closing the API host port

- **GIVEN** this change both removes the `api` host port and aligns the web
  image's baked API defaults
- **WHEN** the changes are sequenced
- **THEN** the web image is rebuilt with the edge-safe `:3001`/edge defaults
  before (or in the same release as) the host-port removal, so no deployed web
  image references the `:3002` host port after that port is gone
