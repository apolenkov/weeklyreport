# Spec Delta

## ADDED Requirements

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
