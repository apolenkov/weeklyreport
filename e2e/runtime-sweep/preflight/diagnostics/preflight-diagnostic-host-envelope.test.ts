import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
  hostEnvelopeModeFromEnvironment,
  parseDarwinMemoryPressure,
  readDarwinHostEnvelopeSnapshot,
} from "./preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "./preflight-diagnostic-host-envelope-evaluator.ts";
import {
  createDiagnosticHostEnvelopeReceipt,
  readHealthyPreResourceReceipt,
  serializeHostEnvelopeRecord,
} from "./preflight-diagnostic-host-envelope-receipt.ts";

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const PAGE_SIZE_BYTES = 16_384;
const FREE_PAGES = 400_000;
const AVAILABLE_PAGES = 1_000_000;

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

describe("diagnostic host envelope", () => {
  it("parses Darwin pressure state and a complete host snapshot", async () => {
    expect(
      parseDarwinMemoryPressure("System-wide memory free percentage: 83%"),
    ).toEqual({ freePercent: 83, state: "normal" });
    expect(
      parseDarwinMemoryPressure(
        "System-wide memory free percentage: 10%\npressure: warning",
      ),
    ).toEqual({ freePercent: 10, state: "warning" });

    const snapshot = await readDarwinHostEnvelopeSnapshot(
      "runtime",
      (command) => {
        if (command === "vm_stat")
          return Promise.resolve(
            [
              "Pages free: 400000.",
              "Pages inactive: 500000.",
              "Pages speculative: 100000.",
              "Pages occupied by compressor: 10.",
              "Pageins: 100.",
              "Pageouts: 20.",
              "Swapins: 30.",
              "Swapouts: 40.",
              "The system has 1100000 pages with a page size of 16384 bytes.",
            ].join("\n"),
          );
        if (command === "sysctl")
          return Promise.resolve(
            "vm.swapusage: total = 4.00G used = 0.10G free = 3.90G",
          );
        return Promise.resolve("System-wide memory free percentage: 83%");
      },
    );

    expect(snapshot).toMatchObject({
      phase: "runtime",
      rawFreeBytes: FREE_PAGES * PAGE_SIZE_BYTES,
      availableBytes: AVAILABLE_PAGES * PAGE_SIZE_BYTES,
      compressedBytes: 10 * PAGE_SIZE_BYTES,
      pressureFreePercent: 83,
      pressureState: "normal",
      pageins: 100,
      swapouts: 40,
    });
  });

  it("keeps the approved binary thresholds explicit", () => {
    expect(HOST_ENVELOPE_THRESHOLDS).toMatchObject({
      baselineRawFreeBytes: 4 * GiB,
      baselineAvailableBytes: 8 * GiB,
      baselineSwapUsedBytes: 512 * MiB,
      abortRawFreeBytes: 2 * GiB,
      abortAvailableBytes: 4 * GiB,
      abortSwapUsedBytes: 1 * GiB,
      hysteresisSamples: 3,
      maxAggregateBytes: 1_048_576,
    });
  });

  it("accepts a healthy runtime sample and resets the breach streak", () => {
    const result = evaluateHostEnvelopeSample({
      snapshot: healthySample(),
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: undefined,
      breachStreaks: {
        rawFreeBytes: 2,
        availableBytes: 2,
        pressureFreePercent: 2,
        compressedBytes: 2,
      },
    });

    expect(result).toMatchObject({
      status: "healthy",
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      nextCounters: {
        pageins: 100,
        pageouts: 10,
        swapins: 20,
        swapouts: 30,
      },
    });
  });

  it("requires three consecutive gauge breaches before abort", () => {
    const sample = healthySample({ rawFreeBytes: 1 * GiB });
    const first = evaluateHostEnvelopeSample({
      snapshot: sample,
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: undefined,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });
    const second = evaluateHostEnvelopeSample({
      snapshot: sample,
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: first.nextCounters,
      breachStreaks: first.breachStreaks,
    });
    const third = evaluateHostEnvelopeSample({
      snapshot: sample,
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: second.nextCounters,
      breachStreaks: second.breachStreaks,
    });

    expect(first.status).toBe("healthy");
    expect(second.status).toBe("healthy");
    expect(third.status).toBe("breach");
  });

  it("does not combine alternating gauge breaches into one hysteresis streak", () => {
    const samples = [
      healthySample({ rawFreeBytes: 1 * GiB }),
      healthySample({ availableBytes: 1 * GiB }),
      healthySample({ rawFreeBytes: 1 * GiB }),
      healthySample({ availableBytes: 1 * GiB }),
    ];
    let breachStreaks = EMPTY_HOST_ENVELOPE_BREACH_STREAKS;
    let priorCounters = undefined;
    for (const snapshot of samples) {
      const result = evaluateHostEnvelopeSample({
        snapshot,
        baselineSwapUsedBytes: 256 * MiB,
        priorCounters,
        breachStreaks,
      });
      expect(result.status).toBe("healthy");
      breachStreaks = result.breachStreaks;
      priorCounters = result.nextCounters;
    }
  });

  it("fails immediately on a cumulative counter reset", () => {
    const result = evaluateHostEnvelopeSample({
      snapshot: healthySample({ pageins: 9 }),
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: { pageins: 10, pageouts: 10, swapins: 20, swapouts: 30 },
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });

    expect(result.status).toBe("invalid");
    expect(result.reasons).toContain("cumulative counter reset or wrap");
  });

  it("fails closed on missing pressure input", () => {
    const result = evaluateHostEnvelopeSample({
      snapshot: healthySample({ pressureFreePercent: null }),
      baselineSwapUsedBytes: 256 * MiB,
      priorCounters: undefined,
      breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
    });

    expect(result.status).toBe("invalid");
  });

  it("uses an explicit closed flag", () => {
    expect(hostEnvelopeModeFromEnvironment({})).toBe("off");
    expect(
      hostEnvelopeModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_HOST_ENVELOPE: "off",
      }),
    ).toBe("off");
    expect(
      hostEnvelopeModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_HOST_ENVELOPE: "enforce",
      }),
    ).toBe("enforce");
    expect(() =>
      hostEnvelopeModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_HOST_ENVELOPE: "yes",
      }),
    ).toThrow("RUNTIME_SWEEP_DIAGNOSTIC_HOST_ENVELOPE");
  });

  it("writes a bounded, source-bound private receipt", async () => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".host-envelope-receipt-"),
    );
    const outputRoot = path.join(archiveRoot, "attempt");
    try {
      const receipt = await createDiagnosticHostEnvelopeReceipt({
        archiveRoot,
        outputRoot,
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "cr-001-host-envelope-test",
      });
      await receipt.record({
        snapshot: { ...healthySample(), phase: "pre-resource" },
        status: "healthy",
        reasons: [],
        breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      });
      const paths = await receipt.finalize({
        status: "healthy",
        reason: "focused receipt test",
      });
      const manifest = JSON.parse(
        await readFile(paths.manifestPath, "utf8"),
      ) as {
        readonly artifact: string;
        readonly recordCount: number;
        readonly payloadBytes: number;
        readonly status: string;
      };
      expect(manifest).toMatchObject({
        artifact: "DIAGNOSTIC_HOST_ENVELOPE",
        recordCount: 1,
        status: "healthy",
      });
      expect(manifest.payloadBytes).toBeGreaterThan(0);
      expect((await stat(paths.recordsPath)).mode & 0o777).toBe(0o600);
      expect((await stat(paths.manifestPath)).mode & 0o777).toBe(0o600);
      await expect(
        readHealthyPreResourceReceipt({
          archiveRoot,
          manifestPath: paths.manifestPath,
          sourceSha: "a".repeat(40),
          sourceTree: "b".repeat(40),
          campaignId: "cr-001-host-envelope-test",
          expectedRecordCount: 1,
        }),
      ).resolves.toMatchObject({ recordCount: 1 });
    } finally {
      await rm(archiveRoot, { recursive: true, force: true });
    }
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
      },
    });
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(
      HOST_ENVELOPE_THRESHOLDS.maxRecordBytes,
    );
    expect(text).toContain('"r":["raw-abort"');
  });
});
