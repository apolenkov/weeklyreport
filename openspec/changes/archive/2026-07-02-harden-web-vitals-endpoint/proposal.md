## Why

`POST /api/web-vitals` is a live, unauthenticated, unthrottled endpoint that
records client metrics directly into Prometheus. It takes `navigationType` from
an unvalidated client string and uses it as a gauge label across five vitals, so
any scanner can grow the metrics heap without bound (label-cardinality memory
DoS). The body has no runtime validation, so a missing or non-numeric `value`
throws and returns a 500. The vitals are stored as `Gauge`s labelled only by
`navigation_type` (last-write-wins), so the web-vitals dashboard shows noise
rather than a p75 distribution. This is the P1 finding BL-WEBVITALS-ENDPOINT
from the 2026-06-28 repo-excellence review.

## What Changes

- Validate the request body at runtime before any metric write: `name` must be a
  known vital, `value` must be a finite number, `id` must be a non-empty string,
  `navigationType` is optional. An invalid body is rejected with `400` and
  records nothing; it never throws a `500`.
- Whitelist `navigationType` against the fixed `web-vitals` navigation enum
  before it becomes a label; any unrecognised value collapses to a single
  bounded `"other"` bucket so label cardinality stays constant.
- Replace the five `Gauge`s with `Histogram`s using per-vital buckets and record
  each sample with `observe(value)`, so `/metrics` exposes a real latency
  distribution (p75/p95) instead of a last-write-wins point.
- Rate-limit the endpoint so unauthenticated traffic cannot abuse it: add a
  dedicated `web-vitals` tier to the existing `express-rate-limit` factory and
  apply it to `/api/web-vitals`. The endpoint stays anonymous by design (the
  browser beacon fires before/without auth), bounded by the limiter. The
  limiter's per-IP boundary depends on `set-express-trust-proxy` (without
  `trust proxy`, `req.ip` is the Caddy container in production, making the
  limiter a single global bucket); see the design `[Dependency]` note. The
  validation and bounded-label fixes are the primary heap/`500` defenses and do
  not depend on it.

## Capabilities

### New Capabilities

- `web-vitals-ingestion`: defines how the api accepts browser web-vitals
  beacons — payload validation, bounded `navigationType` labelling, histogram
  instrumentation, and rate-limiting of the public ingest endpoint.

### Modified Capabilities

<!-- None: no existing capability governs web-vitals ingestion. error-trace-correlation
governs OTel error/trace linking and manual-publish-telemetry governs the publish
counters; neither covers the web-vitals ingest endpoint. -->

## Impact

- Code: `apps/api/src/modules/observability/web-vitals.controller.ts` (add
  validation + bounded label + `observe`), `apps/api/src/infrastructure/metrics/web-vitals.metrics.ts`
  (`Gauge` → `Histogram` with buckets), `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts`
  (new `vitals` tier), `apps/api/src/main.ts` (mount the vitals limiter on
  `/api/web-vitals`).
- Contracts: a shared `web-vitals` payload schema in `packages/shared` (Zod),
  reused by the controller validator, consistent with the repo's
  Zod-and-shared-contracts convention.
- Metrics: the `web_vital_*` series change type from gauge to histogram; any
  Grafana panel reading the old gauge must switch to a histogram query. No
  Prometheus migration is needed (MVP, disposable observability state).
- No schema, database, or production-auth changes. No new top-level dependency
  if validation reuses Zod (already present); `class-validator` is explicitly
  not introduced.
