## Context

`apps/api/src/modules/observability/web-vitals.controller.ts` exposes
`@Post("api/web-vitals")`. It reads an untyped `WebVitalDto` interface (no
runtime check), looks up a `Gauge` per `name`, and calls
`gauge.set({ navigation_type: dto.navigationType ?? "unknown" }, dto.value)`.
`apps/api/src/infrastructure/metrics/web-vitals.metrics.ts` declares the five
`web_vital_*` gauges with a single `navigation_type` label.

Three defects (BL-WEBVITALS-ENDPOINT, P1):

- Unbounded label cardinality: `navigation_type` is an arbitrary client string,
  and prom-client allocates a new child series per distinct label tuple. A
  scanner posting random `navigationType` values grows the metrics heap without
  bound across all five gauges.
- No runtime validation: `dto.value.toFixed(2)` and `gauge.set(..., dto.value)`
  assume a number. A missing or non-numeric `value` throws → `500`.
- Wrong instrument: `Gauge.set` is last-write-wins. A vital is a per-navigation
  sample; the dashboard needs a histogram to compute p75/p95.

The endpoint is mounted on the Nest app and is not behind the existing
`/trpc` or `/auth` express-rate-limit tiers, so it is unthrottled.

Repo constraints that shape the solution:

- The repo validates with Zod and shares contracts from `packages/shared`; it
  does not use `class-validator`/`class-transformer` anywhere
  (`grep` confirms zero usages) and has no global `ValidationPipe`.
- Rate limiting is already a single factory `createRateLimits` in
  `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` returning
  per-prefix express limiters, wired in `main.ts`. There is no
  `@nestjs/throttler`.
- MVP: observability state is disposable, so changing the metric type needs no
  Prometheus data migration.

## Goals / Non-Goals

Goals:

- No `500` from a malformed body; invalid input is a `400` that records nothing.
- Constant `navigation_type` label cardinality regardless of client input.
- `web_vital_*` exposed as histograms with metric-appropriate buckets.
- A rate limit on `/api/web-vitals` that bounds anonymous abuse.

Non-Goals:

- Authenticating the endpoint. The browser beacon legitimately fires before or
  without a session; the rate limit is the abuse boundary, not auth.
- Migrating historical Prometheus data or rebuilding Grafana dashboards beyond
  switching the panel query (left to whoever owns the dashboard).
- Adding `class-validator` or a global `ValidationPipe`.
- Changing the web-side beacon sender; the wire shape stays the same.

## Decisions

### Decision: Validate with a shared Zod schema, not class-validator

Add a `webVitalBeaconSchema` to `packages/shared` and parse the body in the
controller (`schema.safeParse(body)`), returning `400` on failure. This matches
the repo's Zod-and-shared-contracts convention, reuses an already-present
dependency, and keeps the contract in one place for the web sender to import.

Alternatives considered:

- `class-validator` DTO + global `ValidationPipe` (the review's first
  suggestion): idiomatic Nest, but introduces two new deps and a global pipe the
  repo deliberately avoids, and duplicates the validation idiom already
  standardised on Zod. Rejected to stay consistent and dependency-light.
- Inline `typeof` guards: works and is zero-dep, but scatters the contract and
  is easy to drift from the web sender. Rejected in favour of a shared schema.

### Decision: Whitelist navigationType to a fixed enum with an `other` fallback

Define the recognised set as the `web-vitals` library navigation types
(`navigate`, `reload`, `back-forward`, `back-forward-cache`, `prerender`,
`restore`). Map anything else — including absent — to `other`. This caps the
label set at seven values total, which fixes the cardinality DoS at the label
level even if validation upstream were ever bypassed. Keep the whitelist beside
the schema so it is a single source of truth.

### Decision: Gauge → Histogram with per-vital buckets

Replace each `Gauge` with a `Histogram` keeping the same metric names
(`web_vital_lcp`, etc.) and the `navigation_type` label, and record via
`observe(value)`. Buckets:

- Millisecond vitals (`LCP`, `FCP`, `TTFB`, `INP`): buckets spanning the
  good/needs-improvement/poor thresholds, e.g. `[100, 250, 500, 1000, 2000,
4000, 8000]` (tune per vital where the thresholds differ — INP/TTFB are
  smaller than LCP).
- `CLS` (unitless score, typically `0`–`1`): small buckets, e.g. `[0.05, 0.1,
0.25, 0.5, 1, 2]`. The controller currently documents CLS as `score × 1000`;
  keep whatever scaling the web sender emits and size the buckets to match the
  emitted unit — verify against the sender before fixing the numbers.

Keeping the metric names stable means only the panel query changes (gauge →
`histogram_quantile`), not the series identity.

### Decision: Add a `vitals` rate-limit tier to the existing factory

Extend `createRateLimits` to also return a `vitalsLimiter` (e.g. a moderate
per-IP/minute budget, bumped in test like the others) and mount it on
`/api/web-vitals` in `main.ts`, reusing the existing `rateLimitHitsTotal`
bucket accounting. This reuses the proven limiter, IPv6 key handling, and
metrics wiring rather than introducing `@nestjs/throttler`.

[Dependency] The per-IP boundary depends on the `set-express-trust-proxy`
change. The shared limiter keys from `req.ip`
(`rate-limit.middleware.ts` `keyGenerator`), but Express `trust proxy` is not
yet set, so in production behind Caddy `req.ip` resolves to the Caddy
container address, not the real client (see
`openspec/changes/set-express-trust-proxy/design.md`). Until that change lands,
the vitals limiter is effectively a **single global bucket** in production: it
still caps total ingest traffic and removes the unbounded-heap and
unbounded-`500` vectors, but it does **not** provide a true per-client
boundary — one noisy client can consume the shared budget for everyone. This
is an acceptable stopgap because the cardinality and validation fixes are the
primary heap/`500` defenses; the limiter is defense-in-depth. The per-IP claim
becomes real only once `set-express-trust-proxy` enables `trust proxy` so
`req.ip` resolves to the client. Order this change after, or alongside,
`set-express-trust-proxy`; do not claim per-IP vitals throttling until task
4.3 confirms `req.ip` is the client.

## Risks / Trade-offs

- [Histogram type change breaks existing Grafana panels reading the gauge] →
  The series names are stable; only the query changes. Note in the change that
  the panel must move to `histogram_quantile`. MVP disposable observability
  means no data migration.
- [Bucket boundaries chosen wrong give coarse quantiles] → Buckets are cheap to
  retune later; start from web-vitals good/poor thresholds and adjust after
  seeing real traffic.
- [Rate limit too strict drops legitimate beacons under burst] → Pick a budget
  generous enough for a normal page's vitals (a handful per navigation) and bump
  it in test, mirroring the existing tiers.
- [Anonymous endpoint still reachable] → Accepted by design; cardinality is now
  bounded and abuse is rate-limited, which removes the unbounded-heap and
  unbounded-500 vectors that made it dangerous.
- [Limiter is a global bucket without trust proxy] → Until
  `set-express-trust-proxy` lands, `req.ip` is the Caddy container in
  production, so the vitals limiter throttles all clients as one bucket rather
  than per-IP (see the `[Dependency]` note above). Accepted as a stopgap: it
  still bounds total ingest; the per-IP boundary arrives with that change. Task
  4.3 verifies `req.ip` resolves to the client before the per-IP claim is made.

## Migration Plan

1. Add the shared schema + navigation whitelist in `packages/shared`.
2. Swap the metrics module to histograms with buckets.
3. Update the controller to parse, whitelist, and `observe`.
4. Add the `vitals` limiter tier and mount it in `main.ts`.
5. Update any Grafana web-vitals panel to a histogram query (dashboard owner;
   out of code scope here).

Rollback: revert the commits; no schema/data state to unwind (disposable
observability).

## Open Questions

- Exact bucket boundaries per vital and the CLS unit the web sender emits —
  confirm against the browser beacon code before fixing the numbers.
- The precise per-window vitals rate-limit budget — pick a value that comfortably
  covers a real page's beacon count, then tune from observed traffic.
