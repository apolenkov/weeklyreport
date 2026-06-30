import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  customreportActiveLeadsTotal,
  customreportReportsOnTimeRatio,
  metricsRegistry,
} from "../../infrastructure/metrics/metrics.registry.js";
import {
  TelemetryGauges,
  type TelemetryGaugesPort,
} from "./telemetry.gauges.js";

function buildPort(opts: {
  onTimeRatio?: number | null;
  activeLeads?: number;
}): TelemetryGaugesPort {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async TelemetryGaugesPort contract (no awaitable work in the stub)
    async onTimeRatioLastNPeriods() {
      return opts.onTimeRatio ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async TelemetryGaugesPort contract (no awaitable work in the stub)
    async activeLeadsLastPublishedPeriod() {
      return opts.activeLeads ?? 0;
    },
  };
}

/**
 * Port whose every query rejects with `error`. Drives the DB-outage
 * fault-isolation path: each method genuinely awaits before throwing so
 * the rejection is a real async rejection (mirrors a Prisma failure) and
 * the stub satisfies the require-await lint rule without a suppression.
 */
function buildThrowingPort(error: Error): TelemetryGaugesPort {
  return {
    async onTimeRatioLastNPeriods() {
      await Promise.resolve();
      throw error;
    },
    async activeLeadsLastPublishedPeriod() {
      await Promise.resolve();
      throw error;
    },
  };
}

async function gaugeValue(gauge: {
  get(): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record (migrated from eslint-disable)
    values: { value: number; labels: Record<string, any> }[];
  }>;
}): Promise<number | null> {
  const snapshot = await gauge.get();
  const first = snapshot.values.at(0);
  return first?.value ?? null;
}

describe("TelemetryGauges — Phase 52-A (UFB-054)", () => {
  it("on-time ratio gauge updates from the port at scrape time", async () => {
    const gauges = new TelemetryGauges(buildPort({ onTimeRatio: 0.85 }));
    gauges.onModuleInit();

    // eslint-disable-next-line sonarjs/no-floating-point-equality -- asserts the port value (0.85) passes through the gauge unchanged; exact equality is intended
    expect(await gaugeValue(customreportReportsOnTimeRatio)).toBe(0.85);

    gauges.onModuleDestroy();
  });

  it("active-leads gauge updates from the port at scrape time", async () => {
    const gauges = new TelemetryGauges(buildPort({ activeLeads: 6 }));
    gauges.onModuleInit();

    expect(await gaugeValue(customreportActiveLeadsTotal)).toBe(6);

    gauges.onModuleDestroy();
  });

  it("on-time ratio gauge stays unset when the port returns null (no eligible data)", async () => {
    // Pre-set a sentinel so we can prove the collect callback did NOT
    // overwrite it when the port returns null. Real production would
    // surface NaN to Prom; the dashboard renders that as "no data".
    customreportReportsOnTimeRatio.set(0.42);
    const gauges = new TelemetryGauges(buildPort({ onTimeRatio: null }));
    gauges.onModuleInit();

    // eslint-disable-next-line sonarjs/no-floating-point-equality -- asserts the pre-set sentinel (0.42) is preserved when the port returns null; exact equality is intended
    expect(await gaugeValue(customreportReportsOnTimeRatio)).toBe(0.42);

    gauges.onModuleDestroy();
  });

  it("onModuleDestroy clears the collect callback so a torn-down port does not fire", async () => {
    const gauges = new TelemetryGauges(buildPort({ activeLeads: 9 }));
    gauges.onModuleInit();
    expect(await gaugeValue(customreportActiveLeadsTotal)).toBe(9);

    // After destroy, the collect callback becomes a no-op — the gauge
    // value is whatever it was last set to. We verify by swapping in a
    // throwing port: if the callback still fired, the test would error.
    gauges.onModuleDestroy();
    customreportActiveLeadsTotal.set(0);
    // Re-fetching should not invoke the (now no-op) callback.
    expect(await gaugeValue(customreportActiveLeadsTotal)).toBe(0);
  });
});

describe("TelemetryGauges — DB-outage fault isolation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("on-time ratio collect swallows a query rejection, logs it, and leaves the gauge unset", async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    // Pre-set a sentinel so we can prove the failing collect callback did
    // NOT overwrite it — the gauge keeps its last good value for this cycle.
    customreportReportsOnTimeRatio.set(0.42);
    const gauges = new TelemetryGauges(buildThrowingPort(new Error("db down")));
    gauges.onModuleInit();

    // gaugeValue triggers the collect callback; it must resolve, not reject.
    // eslint-disable-next-line sonarjs/no-floating-point-equality -- asserts the pre-set sentinel (0.42) is preserved when the query throws; exact equality is intended
    expect(await gaugeValue(customreportReportsOnTimeRatio)).toBe(0.42);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("customreportReportsOnTimeRatio"),
      expect.anything(),
    );

    gauges.onModuleDestroy();
  });

  it("active-leads collect swallows a query rejection, logs it, and keeps the last value", async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    customreportActiveLeadsTotal.set(7);
    const gauges = new TelemetryGauges(buildThrowingPort(new Error("db down")));
    gauges.onModuleInit();

    expect(await gaugeValue(customreportActiveLeadsTotal)).toBe(7);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("customreportActiveLeadsTotal"),
      expect.anything(),
    );

    gauges.onModuleDestroy();
  });

  it("both collect callbacks fail in one cycle: both log, neither propagates", async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const gauges = new TelemetryGauges(buildThrowingPort(new Error("db down")));
    gauges.onModuleInit();

    // Exercise both collect callbacks in the same scrape cycle.
    await gaugeValue(customreportReportsOnTimeRatio);
    await gaugeValue(customreportActiveLeadsTotal);

    expect(errorSpy).toHaveBeenCalledTimes(2);

    gauges.onModuleDestroy();
  });

  it("registry scrape survives failing DB-backed collect callbacks and still emits DB-independent metrics", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const gauges = new TelemetryGauges(buildThrowingPort(new Error("db down")));
    gauges.onModuleInit();

    // Registry.metrics() runs Promise.all over every registered collect
    // callback; without per-callback fault isolation a single rejection
    // here would reject the whole scrape (a 500 to Prometheus).
    const scrape = await metricsRegistry.metrics();

    // Process-level default metrics are always registered and are
    // independent of the DB — they must survive the failing callbacks.
    expect(scrape).toContain("process_cpu");

    gauges.onModuleDestroy();
  });
});
