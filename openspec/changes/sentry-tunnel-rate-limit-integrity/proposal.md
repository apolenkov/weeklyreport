# Proposal

## Why

The same-origin Sentry envelope tunnel had two rate-limit integrity gaps:

- Its process-local admission quota measured fixed windows with `Date.now()`,
  so a wall-clock rollback (NTP step, manual clock change) stretched a
  client's active window and prolonged the block beyond the configured 60s.
- The POST handler dropped every upstream response header, so
  `Retry-After` and `X-Sentry-Rate-Limits` never reached the installed SDK —
  it fell back to a guessed 60s backoff and could not see category limits
  delivered on 2xx responses.

## What Changes

- The quota's default clock becomes `performance.now()` (monotonic); injected
  `now` values stay on the same monotonic scale. Window length, per-client
  limit, and bucket bounds are unchanged.
- The tunnel response forwards exactly two upstream headers —
  `retry-after` and `x-sentry-rate-limits` — with the preserved status and an
  empty public body. No arbitrary upstream header (cookies, etc.) is exposed.
- Local admission `429`/`Retry-After: 60` and best-effort `204` on transport
  failure are unchanged; an upstream error status is never normalized to
  success.

## Capabilities

### public-endpoint-resource-limits

Two new requirements for the telemetry tunnel surface: monotonic quota
windows, and transparent forwarding of Sentry rate-limit metadata.

## Impact

- `apps/web/src/app/monitoring/sentry-tunnel-quota.ts` — monotonic default
  clock.
- `apps/web/src/app/monitoring/sentry-tunnel.ts` — wrapper delegates the
  default to the quota owner.
- `apps/web/src/app/monitoring/route.ts` — bounded header forwarding.
- No deployment, schema, or dependency changes.
