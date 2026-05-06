# Phase 37, Plan 01 — SUMMARY

**REQ-IDs:** OBS-01
**Status:** complete

## What shipped

- `apps/api/src/infrastructure/otel/otel.bootstrap.ts` (NEW) — `startOtel(env)` constructs an `@opentelemetry/sdk-node` `NodeSDK` with `OTLPTraceExporter` (HTTP/protobuf) targeting `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`, a `TraceIdRatioBasedSampler` (default 0.1, env-overrideable via `OTEL_TRACES_SAMPLER_ARG`), and three instrumentations: `HttpInstrumentation`, `ExpressInstrumentation`, `PrismaInstrumentation`. SIGTERM/SIGINT handlers flush via `sdk.shutdown()`. `decideOtelBootstrap()` is exported separately so the env-knob → start/skip mapping is unit-testable without booting the SDK.
- `apps/api/src/infrastructure/otel/otel.bootstrap.test.ts` (NEW) — 7 unit tests on the decision logic: kill-switch wins over endpoint, no-endpoint short-circuits, default ratio is 0.1, custom ratio honoured, malformed ratio falls back, out-of-range ratios clamp, case-insensitive disable.
- `apps/api/src/main.ts` — `startOtel()` imported and invoked at the very top (after `reflect-metadata` only) so the SDK monkey-patches `http`/`express` and registers Prisma hooks BEFORE NestJS modules pull those in. Boot log emits a structured "otel sdk started/disabled" line with reason for ops visibility.
- `apps/api/src/infrastructure/config/env.schema.ts` — adds five OTel knobs:
  - `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL — unset → SDK doesn't start)
  - `OTEL_SDK_DISABLED` (string default 'false' — hard kill switch overriding endpoint)
  - `OTEL_TRACES_SAMPLER_ARG` (number 0..1, default 0.1)
  - `OTEL_SERVICE_NAME` (optional, default 'customreport-api')
  - `OTEL_SERVICE_VERSION` (optional, default 'dev')
- `.env.example` — adds an OTel block documenting the disabled-by-default posture, recommended endpoint shape (`http://otel-collector:4318` — port 4318 is OTLP/HTTP per spec), and the kill-switch.
- `apps/api/package.json` — adds nine `@opentelemetry/*` deps + `@prisma/instrumentation`.

## Why import order matters

The OTel SDK monkey-patches `http`, `express`, and `@prisma/client` at start time. If those modules are imported BEFORE `startOtel()`, the instrumentation can't attach (the cached module reference is already in memory). Hence `main.ts` imports the bootstrap right after `reflect-metadata` (which has its own monkey-patching reasons) and before `@nestjs/core`, `express`, etc. Prisma instrumentation is layered into `@prisma/client` via the same mechanism, but only the FIRST `PrismaClient` constructor sees it — the bootstrap fires before `apps/api/src/infrastructure/prisma/prisma.service.ts` is loaded by the NestJS factory.

## Verification

```bash
pnpm --filter @customreport/api test src/infrastructure/otel/otel.bootstrap.test.ts
# 7/7 green

pnpm --filter @customreport/api test
# 623/623 green (was 616/616; +7 new)

pnpm --filter @customreport/api typecheck
# clean
```

## Manual smoke (deferred — needs a collector)

```bash
# Start the api with OTel enabled, pointing at a local collector
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_TRACES_SAMPLER_ARG=1.0 \
pnpm --filter @customreport/api dev

# Verify a span lands in the collector
curl http://localhost:3001/health/live
# Then check the collector — should see 1 trace with HTTP root span +
# nested Express middleware spans + (if a /trpc query was hit) Prisma child
# spans.

# Hard kill switch
OTEL_SDK_DISABLED=true \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
pnpm --filter @customreport/api dev
# expect log line: "otel sdk disabled" reason=disabled-flag
```

## Files

- `apps/api/package.json` (deps)
- `apps/api/src/infrastructure/otel/otel.bootstrap.ts` (new)
- `apps/api/src/infrastructure/otel/otel.bootstrap.test.ts` (new)
- `apps/api/src/infrastructure/config/env.schema.ts` (5 OTel knobs)
- `apps/api/src/main.ts` (import order + boot log)
- `.env.example` (OTel block)
