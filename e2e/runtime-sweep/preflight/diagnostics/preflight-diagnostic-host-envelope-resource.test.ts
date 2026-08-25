import { describe, expect, it } from "vitest";

import {
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
} from "./preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "./preflight-diagnostic-host-envelope-evaluator.ts";
import { serializeHostEnvelopeRecord } from "./preflight-diagnostic-host-envelope-receipt.ts";

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

const healthySample = (
  overrides: Partial<DiagnosticHostEnvelopeSnapshot> = {},
): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall: 1_700_000_000_000,
  phase: "runtime",
  rawFreeBytes: 6 * GiB,
  availableBytes: 12 * GiB,
  totalBytes: 36 * GiB,
  compressedBytes: 4 * GiB,
  swapUsedBytes: 256 * MiB,
  swapFreeBytes: 4 * GiB,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100,
  pageouts: 10,
  swapins: 20,
  swapouts: 30,
  ...overrides,
});

describe("Darwin historical swap and current pressure contract", () => {
  it("accepts stable historical swap occupancy at baseline and runtime", () => {
    const historicalSwap = 2 * GiB;
    const baseline = evaluateHostEnvelopeSample({
      snapshot: healthySample({
        phase: "post-infrastructure",
        swapUsedBytes: historicalSwap,
        swapFreeBytes: 1 * GiB,
      }),
      mode: "baseline",
      baselineSwapUsedBytes: historicalSwap,
      priorCounters: undefined,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });
    const runtime = evaluateHostEnvelopeSample({
      snapshot: healthySample({ swapUsedBytes: historicalSwap }),
      baselineSwapUsedBytes: historicalSwap,
      priorCounters: baseline.nextCounters,
      breachStreaks: baseline.breachStreaks,
    });

    expect(baseline.status).toBe("healthy");
    expect(runtime.status).toBe("healthy");
    expect(runtime.reasons).toEqual([]);
  });

  it.each([
    [
      "low swap headroom",
      { swapFreeBytes: 511 * MiB },
      "swap free below minimum headroom",
    ],
    [
      "attempt-relative swap growth",
      { swapUsedBytes: 769 * MiB },
      "swap growth above abort threshold",
    ],
    [
      "memory pressure",
      { pressureState: "warning" as const },
      "memory pressure state is not normal",
    ],
  ])("fails immediately on %s", (_name, overrides, reason) => {
    const result = evaluateHostEnvelopeSample({
      snapshot: healthySample(overrides),
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: undefined,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });

    expect(result.status).toBe("breach");
    expect(result.reasons).toContain(reason);
  });

  it("fails after three consecutive swap-out activity samples", () => {
    let priorCounters = {
      pageins: 100,
      pageouts: 10,
      swapins: 20,
      swapouts: 30,
    };
    let breachStreaks = EMPTY_HOST_ENVELOPE_BREACH_STREAKS;
    const statuses: string[] = [];
    for (let index = 1; index <= 3; index += 1) {
      const result = evaluateHostEnvelopeSample({
        snapshot: healthySample({
          pageins: 100 + index,
          pageouts: 10 + index,
          swapins: 20 + index,
          swapouts: 30 + index,
        }),
        baselineSwapUsedBytes: 256 * MiB,
        priorCounters,
        breachStreaks,
      });
      statuses.push(result.status);
      priorCounters = result.nextCounters ?? priorCounters;
      breachStreaks = result.breachStreaks;
    }

    expect(statuses).toEqual(["healthy", "healthy", "breach"]);
    expect(breachStreaks.swapActivity).toBe(3);
  });

  it("keeps a multi-breach receipt record within the byte bound", () => {
    const text = serializeHostEnvelopeRecord({
      snapshot: healthySample({
        timestampWall: Number.MAX_SAFE_INTEGER,
        rawFreeBytes: 1 * GiB,
        availableBytes: 1 * GiB,
        totalBytes: Number.MAX_SAFE_INTEGER,
        pressureFreePercent: 5,
        compressedBytes: 20 * GiB,
        swapUsedBytes: Number.MAX_SAFE_INTEGER,
        swapFreeBytes: Number.MAX_SAFE_INTEGER,
        pageins: Number.MAX_SAFE_INTEGER,
        pageouts: Number.MAX_SAFE_INTEGER,
        swapins: Number.MAX_SAFE_INTEGER,
        swapouts: Number.MAX_SAFE_INTEGER,
        pressureState: "warning",
      }),
      status: "breach",
      reasons: [
        "raw free memory below abort threshold",
        "available memory below abort threshold",
        "memory pressure free percentage below abort threshold",
        "compressed memory above abort threshold",
        "memory pressure state is not normal",
      ],
      breachStreaks: {
        rawFreeBytes: 3,
        availableBytes: 3,
        pressureFreePercent: 3,
        compressedBytes: 3,
        swapActivity: 3,
      },
    });
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(
      HOST_ENVELOPE_THRESHOLDS.maxRecordBytes,
    );
    expect(text).toContain('"r":["raw-abort"');
  });
});
