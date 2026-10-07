# Tasks

## 1. Monotonic quota clock

- [x] 1.1 `SentryTunnelQuota.consume` defaults `now` to `performance.now()`;
      `consumeSentryTunnelQuota` delegates the default instead of injecting
      `Date.now()`.
- [x] 1.2 Route tests cover a wall-clock rollback inside a monotonic window
      and monotonic expiry, on top of the existing bucket-bounds cases.

## 2. Upstream rate-limit transparency

- [x] 2.1 `POST` returns the upstream status with only `retry-after` and
      `x-sentry-rate-limits` forwarded; cookies and other upstream headers stay
      behind the boundary.
- [x] 2.2 Route tests cover upstream `429` + `Retry-After`, upstream `200` +
      `X-Sentry-Rate-Limits`, and unchanged local `429`/transport `204`.

## 3. Spec

- [x] 3.1 Spec delta added under `openspec/changes/` for
      `public-endpoint-resource-limits`; main spec is updated on archive.
