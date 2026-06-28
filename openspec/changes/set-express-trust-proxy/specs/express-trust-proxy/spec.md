## ADDED Requirements

### Requirement: Bootstrap configures Express proxy trust before middleware

The system SHALL call `expressApp.set('trust proxy', 1)` in
`apps/api/src/main.ts` on the raw Express instance, before any rate-limit or
audit middleware is mounted, so that `req.ip` throughout the application
reflects the real client IP resolved from the `X-Forwarded-For` header
supplied by the Caddy edge proxy.

#### Scenario: Rate-limit middleware receives real client IP

- **GIVEN** the API is running behind the Caddy edge proxy
- **WHEN** a request arrives with an `X-Forwarded-For: <client-ip>` header
- **THEN** `req.ip` in the rate-limit key generator equals `<client-ip>`,
  not the Caddy container IP

#### Scenario: Audit log records real client IP

- **GIVEN** the API is running behind the Caddy edge proxy
- **WHEN** a tRPC procedure executes and emits an audit entry via
  `trpc.context.ts`
- **THEN** the audit entry's `ip` field contains the real client IP, not the
  proxy address

#### Scenario: HTTP access log records real client IP

- **GIVEN** the API is running behind the Caddy edge proxy
- **WHEN** any non-tRPC request (auth, health, metrics) is processed
- **THEN** the structured HTTP access log entry's `ip` field contains the
  real client IP

### Requirement: Trust-proxy must not let non-edge ingress spoof the client IP

The system SHALL ensure that, with `trust proxy` enabled, only the Caddy edge
hop can influence `req.ip`; production deployment MUST therefore make Caddy the
sole ingress to the Express socket before trust proxy is enabled, because a
caller reaching the API outside the Caddy hop could otherwise forge
`X-Forwarded-For` and have Express resolve `req.ip` to the spoofed value,
evading the auth rate limit and poisoning the audit and HTTP access logs.

The direct API host-port publication in `docker-compose.prod.yml`
(`${API_PORT:-3001}:3001`) is the concrete non-edge ingress and is owned by the
separate deploy-seam concern `BL-DEPLOY-SEAM-MISC`; production enablement of
trust proxy is gated on that port being removed or bound to localhost. A
CIDR-based trust list does NOT satisfy this requirement, because Docker
host-published traffic arrives from the bridge gateway inside the same
compose-network subnet as Caddy.

#### Scenario: Forged X-Forwarded-For on a direct non-Caddy connection is not trusted

- **GIVEN** trust proxy is enabled on the Express instance
- **AND** the production API is reachable only through the Caddy edge (the
  direct host port is closed per `BL-DEPLOY-SEAM-MISC`)
- **WHEN** an attacker attempts to connect to the API outside the Caddy hop and
  sends a forged `X-Forwarded-For: 203.0.113.99`
- **THEN** the connection does not reach the Express socket, so the forged
  header cannot set `req.ip`, and the rate-limit key and audit IP are unaffected

#### Scenario: Production rollout is gated on host-port closure

- **GIVEN** trust proxy has been added to `main.ts`
- **WHEN** a production rollout is prepared while the API container port is still
  host-published in `docker-compose.prod.yml`
- **THEN** trust proxy MUST NOT be enabled in production until the direct host
  port is removed or bound to localhost (the deploy-seam prerequisite)

### Requirement: False trust-proxy comment is removed from rate-limit middleware

The system SHALL NOT contain the claim that `app.set('trust proxy', 1)` is
set upstream in `rate-limit.middleware.ts`; the misleading comment that
previously asserted this MUST be deleted.

#### Scenario: No false comment in rate-limit middleware after change

- **GIVEN** the updated `rate-limit.middleware.ts`
- **WHEN** the file is inspected for the phrase `upstream makes this safe`
  or equivalent claims about proxy trust being pre-configured externally
- **THEN** no such claim exists in the file

### Requirement: Unit test verifies req.ip resolution from X-Forwarded-For

The system SHALL include a Vitest unit test for the rate-limit middleware that
asserts `req.ip` resolves from the `X-Forwarded-For` header when Express is
configured with `trust proxy: 1`.

#### Scenario: IP key generator uses X-Forwarded-For under trust proxy

- **GIVEN** a minimal Express application with `trust proxy` set to `1`
  and the rate-limit middleware mounted
- **WHEN** a request arrives with `X-Forwarded-For: 203.0.113.42` and the
  socket remote address is `172.18.0.2` (simulating the Caddy container)
- **THEN** the `keyGenerator` receives `req.ip === '203.0.113.42'` and
  returns a key derived from that address

#### Scenario: IP key generator falls back when no forwarded header present

- **GIVEN** a minimal Express application with `trust proxy` set to `1`
  and the rate-limit middleware mounted
- **WHEN** a request arrives with no `X-Forwarded-For` header and a socket
  remote address of `127.0.0.1`
- **THEN** the `keyGenerator` receives `req.ip === '127.0.0.1'` and returns
  a key derived from that loopback address
