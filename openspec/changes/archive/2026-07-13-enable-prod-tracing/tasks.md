## 1. Wire the prod OTLP endpoint to the composed collector

- [ ] 1.1 `docker-compose.prod.yml`: add
      `OTEL_EXPORTER_OTLP_ENDPOINT: ${OTEL_EXPORTER_OTLP_ENDPOINT:-http://otel-lgtm:4318}`
      to the api service's environment block, next to the existing
      `OTEL_SDK_DISABLED` / `OTEL_TRACES_SAMPLER_ARG` lines
- [ ] 1.2 Bump `OTEL_TRACES_SAMPLER_ARG: ${OTEL_TRACES_SAMPLER_ARG:-0.1}` to
      `${OTEL_TRACES_SAMPLER_ARG:-1.0}`
- [ ] 1.3 Add a line to the file's top-of-file usage comment stating that
      prod tracing requires composing `docker-compose.observability.yml`
      (`docker compose -f docker-compose.prod.yml -f
docker-compose.observability.yml up -d`) or overriding
      `OTEL_EXPORTER_OTLP_ENDPOINT` with an external managed collector;
      leaving the endpoint unreachable is a supported "tracing off" choice,
      made loud by task 3.1 below

## 2. ParentBased sampler + higher default ratio

- [ ] 2.1 `otel.bootstrap.ts`: import `ParentBasedSampler` from
      `@opentelemetry/sdk-trace-base` alongside `TraceIdRatioBasedSampler`
- [ ] 2.2 Change `DEFAULT_TRACES_SAMPLING_RATIO` from `0.1` to `1.0`
- [ ] 2.3 In `startOtel`, replace `sampler: new
TraceIdRatioBasedSampler(decision.samplingRatio)` with `sampler: new
ParentBasedSampler({ root: new
TraceIdRatioBasedSampler(decision.samplingRatio) })` so a parent span's
      sampled-in decision is always honored and only root spans consult the
      ratio
- [ ] 2.4 `otel.bootstrap.test.ts`: update the four assertions pinned to the
      old `0.1` default (`returns enabled with default sampling ratio 0.1
when only endpoint is set`, the malformed-arg fallback case, the
      too-high clamp case, the negative clamp case) to assert `1.0`; rename
      the malformed/out-of-range test descriptions if they still say "falls
      back to 0.1"

## 3. Loud boot log when tracing is off

- [ ] 3.1 `main.ts`: change the `otel sdk disabled` log call from
      `logger.info(...)` to `logger.warn(...)`; keep the same `phase: "otel"`
      / `reason` payload shape

## 4. Spec delta

- [ ] 4.1 `prod-trace-sampling`: ADD the three requirements in
      `specs/prod-trace-sampling/spec.md` (endpoint default, ParentBased
      sampler + ratio default, loud disabled-boot log)

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `cd apps/api && pnpm exec vitest run src/infrastructure/otel/otel.bootstrap.test.ts`
- [ ] 5.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.4 `docker compose -f docker-compose.prod.yml -f docker-compose.observability.yml config` to confirm the api service resolves `OTEL_EXPORTER_OTLP_ENDPOINT` to `http://otel-lgtm:4318` with no other overrides set
- [ ] 5.5 Live-check: boot the api against the composed overlay, hit a tRPC
      route, and confirm a trace with a browser-originated `sentry-trace` /
      `traceparent` header appears as one trace in Tempo with the api's span
      attached (not sampled out)
- [ ] 5.6 Live-check: unset `OTEL_EXPORTER_OTLP_ENDPOINT` (no overlay
      composed) and confirm the boot log emits `otel sdk disabled` at `warn`
- [ ] 5.7 `openspec validate enable-prod-tracing --strict`
- [ ] 5.8 Adversarial review of the diff (two independent reviewers) before
      archiving
