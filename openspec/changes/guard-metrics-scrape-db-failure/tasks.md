## 1. API — TelemetryGauges fault isolation

- [ ] 1.1 In `apps/api/src/modules/telemetry/telemetry.gauges.ts`, add
      `import { Logger } from "@nestjs/common"` and declare
      `private readonly logger = new Logger(TelemetryGauges.name)` as a
      class-field initializer on `TelemetryGauges` (no constructor change).
- [ ] 1.2 Wrap the `await this.repo.onTimeRatioLastNPeriods(4)` call in the
      `onTimeRatio.collect` callback with `try/catch`; on catch, call
      `this.logger.error('customreportReportsOnTimeRatio collect failed', err)`
      and return without calling `customreportReportsOnTimeRatio.set()`.
- [ ] 1.3 Wrap the `await this.repo.activeLeadsLastPublishedPeriod()` call in
      the `activeLeads.collect` callback with `try/catch`; on catch, call
      `this.logger.error('customreportActiveLeadsTotal collect failed', err)` and
      return without calling `customreportActiveLeadsTotal.set()`.

## 2. Tests — error-branch coverage

- [ ] 2.1 In `apps/api/src/modules/telemetry/telemetry.gauges.test.ts`, add a
      `buildThrowingPort` helper (or extend `buildPort`) that returns a
      `TelemetryGaugesPort` whose methods reject with a test-fixture `Error`.
- [ ] 2.2 Add a test: when `onTimeRatioLastNPeriods` throws, the `collect`
      callback resolves without error; pre-set the gauge to a sentinel value and
      assert it is preserved (same 0.42-sentinel pattern as the null-path test).
      Also spy on `Logger.prototype.error` and assert it is called with a message
      that names `customreportReportsOnTimeRatio`.
- [ ] 2.3 Add a test: when `activeLeadsLastPublishedPeriod` throws, the
      `collect` callback resolves without error; assert the gauge keeps its
      last-set value. Assert `Logger.prototype.error` is called with a message
      that names `customreportActiveLeadsTotal`.
- [ ] 2.4 Add a test: when both callbacks throw in the same scrape cycle (call
      both `collect` functions), both errors are logged and neither propagates —
      verify by asserting `Logger.prototype.error` call count is 2 and no
      exception is thrown from either call.
- [ ] 2.5 Add a registry-boundary test that exercises the real failure path:
      import `metricsRegistry` from
      `apps/api/src/infrastructure/metrics/metrics.registry.ts`, install the
      throwing-port `TelemetryGauges` via `onModuleInit`, then `await
    metricsRegistry.metrics()` and assert (a) the promise resolves without
      rejecting and (b) the returned scrape text still contains a known
      DB-independent metric family (e.g. `process_cpu`/`nodejs_heap` or another
      always-registered counter), proving the `Promise.all` aggregation in
      `Registry.metrics()` survives the failing collect callbacks. This is the
      scenario the spec asserts but the per-callback tests above do not cover.

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` from the repo root and confirm exit 0.
- [ ] 3.2 Run `pnpm lint` from the repo root and confirm exit 0.
- [ ] 3.3 Run `pnpm test` from the repo root and confirm all new and existing
      `telemetry.gauges.test.ts` cases pass.
- [ ] 3.4 Run `pnpm build` from the repo root and confirm exit 0.
