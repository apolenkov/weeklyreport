# public-endpoint-resource-limits

## Purpose

Bound resource consumption on unauthenticated api ingress surfaces (rate and body size) so public endpoints cannot be abused.

## Requirements

### Requirement: Unauthenticated api ingress surfaces are rate-limited per IP

Every unauthenticated HTTP ingress surface on the api bootstrap MUST be
rate-limited per client IP before its terminating handler runs
(`apps/api/src/main.ts`). This explicitly includes `/api/client-logs`: it MUST
be guarded by a limiter built from the shared `createRateLimits` `baseConfig`
(`apps/api/src/infrastructure/throttler/rate-limit.middleware.ts`) — per-IP
keying via `ipKeyGenerator`, `429` on exceed, and `rateLimitHitsTotal`
accounting under its own bucket — registered ahead of the handler that writes
client log entries to the shared `app.log`. A public ingress surface MUST NOT
rely on the edge proxy for rate limiting when the Caddyfile does not match its
route.

#### Scenario: client-logs request stream exceeds the limit

- **WHEN** an unauthenticated caller POSTs to `/api/client-logs` more times per
  minute than the configured limit from a single client IP
- **THEN** requests past the limit receive `429` with the shared rate-limit
  error body, the excess is not written to `app.log`, and each rejection
  increments `rateLimitHitsTotal` under the `"client-logs"` bucket

#### Scenario: legitimate client-logs traffic under the limit

- **WHEN** a page emits its normal bounded burst of client-log batches within
  the per-minute limit
- **THEN** the requests are accepted and forwarded to the file sink as before

#### Scenario: test mode raises the ceiling

- **WHEN** the api runs with `NODE_ENV=test` or `AUTH_DEV_MODE`
- **THEN** the client-logs limiter uses the shared `TEST_MODE_LIMIT_PER_MINUTE`
  ceiling for rapid local requests

### Requirement: Public ingress body sizes are bounded by an explicit limit

Each unauthenticated api ingress surface that parses a request body MUST cap the
body size with an explicit, named limit rather than an implicit framework
default. The tRPC express adapter (`trpcExpress.createExpressMiddleware` in
`apps/api/src/main.ts`) MUST be given an explicit body-size bound (via
`maxBodySize` or a preceding `express.json` limit) using a named byte constant,
matching how the `/api/client-logs` handler already sets `express.json({ limit:
"128kb" })` explicitly.

#### Scenario: an oversized tRPC mutation body

- **WHEN** a tRPC mutation arrives with a serialized body larger than the
  configured limit
- **THEN** the request is rejected with `413` before the procedure runs

#### Scenario: a normal tRPC mutation body

- **WHEN** a tRPC mutation arrives with a body within the configured limit
- **THEN** the request is parsed and the procedure executes as before

#### Scenario: the limit is auditable in code

- **WHEN** a reviewer inspects the tRPC ingress mount
- **THEN** the body-size bound is a named constant visible at the mount site,
  not an undocumented adapter default

### Requirement: Numeric Fields On A Public Beacon Are Range-Bounded

A Zod schema validating a body posted to an unauthenticated public ingress surface MUST bound every numeric field with both a lower and an upper limit, not a lower bound alone.

For example, `webVitalBeaconSchema` on `POST /api/web-vitals` is one such
surface. An unbounded numeric field on a public endpoint lets a single
adversarial or buggy request corrupt derived aggregates (e.g. a Prometheus
histogram's `_sum`) that assume realistic input.

For `POST /api/web-vitals`, the system MUST accept CLS scores only in the inclusive range 0–10 and timing metrics (`LCP`, `FCP`, `INP`, `TTFB`) only in the inclusive range 0–300000 milliseconds. The CLS ceiling is an input validation bound, not a product performance threshold.

#### Scenario: An out-of-range web-vital value is rejected

- **WHEN** an unauthenticated caller posts a `webVitalBeaconSchema` body whose
  `value` exceeds the documented maximum
- **THEN** the beacon is rejected before any metric write
- **AND** a realistic in-range `value` for every supported `name`
  (`LCP`, `CLS`, `FCP`, `INP`, `TTFB`) still parses successfully

#### Scenario: Oversized CLS is rejected without an observation

- **WHEN** an unauthenticated caller posts a CLS beacon with `value` above 10
- **THEN** the response is 400 and no histogram observation is written
- **AND** validation identifies the `value` field

#### Scenario: Inclusive metric-specific boundaries remain accepted

- **WHEN** a caller posts CLS with `value` 0 or 10, or a timing metric with `value` 300000
- **THEN** the beacon is accepted and recorded in its corresponding histogram

### Requirement: The Sentry tunnel admission quota runs on a monotonic clock

The process-local quota that admits browser telemetry envelopes MUST measure
its fixed window against a monotonic clock (`performance.now()`), never wall
time. A wall-clock rollback MUST NOT extend a client's active window or delay
bucket expiry. Quota time values are internal — no HTTP-supplied timestamp
may participate in window math.

#### Scenario: A wall-clock rollback cannot stretch a quota window

- **GIVEN** a client has exhausted its per-window request budget
- **WHEN** the system wall clock moves backward while the monotonic clock
  keeps advancing normally
- **THEN** the client stays limited until the monotonic window expires
- **AND** the first consume after the monotonic expiry is admitted

### Requirement: The Sentry tunnel forwards upstream rate-limit metadata

When the tunnel forwards an envelope upstream, it MUST return the upstream
status with exactly `Retry-After` and `X-Sentry-Rate-Limits` carried over when
present, so the installed SDK applies the real backoff and sees category
limits delivered on any status. Arbitrary upstream headers (cookies, caches,
body-adjacent fields) MUST NOT be forwarded, and the response body stays
empty.

#### Scenario: An upstream 429 reaches the SDK with its real retry hint

- **WHEN** the configured Sentry endpoint answers `429` with
  `Retry-After: 3600`
- **THEN** the tunnel responds `429` with `Retry-After: 3600` and no other
  upstream headers

#### Scenario: A category quota hint on 2xx is not dropped

- **WHEN** the configured Sentry endpoint answers `200` with an
  `X-Sentry-Rate-Limits` category quota
- **THEN** the tunnel responds `200` carrying that same header

#### Scenario: Local limits and best-effort failures are unchanged

- **WHEN** the tunnel's own admission quota rejects, or the upstream fetch
  throws
- **THEN** the response is the local `429`/`Retry-After: 60`, or the
  best-effort `204` — never an upstream-shaped error
