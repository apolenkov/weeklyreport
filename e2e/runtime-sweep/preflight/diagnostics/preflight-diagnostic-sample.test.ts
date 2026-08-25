import { describe, expect, it } from "vitest";

import { diagnosticSampleForProcess } from "./preflight-diagnostic-sample.ts";
import { serializeDiagnosticSample } from "./sidecar/preflight-diagnostic-sidecar-contract.ts";

describe("diagnostic sample host pressure", () => {
  it("reuses one complete host snapshot without exceeding the record bound", () => {
    const sample = diagnosticSampleForProcess({
      recordKind: "sample",
      elapsedMs: 1000,
      stage: "navigate",
      currentOperation: "navigate",
      failureKind: "none",
      process: {
        pid: 101,
        processRole: "playwright-child",
        processStartWall: 1_787_399_999_000,
        parentPid: null,
        ownerRootPid: 101,
        processRssBytes: 729_776_128,
        processVsizeBytes: null,
        cpuPercent: 12.5,
      },
      hostPressure: {
        compressedBytes: 2_000_000_000,
        swapTotalBytes: 7_000_000_000,
        swapUsedBytes: 2_000_000_000,
        swapFreeBytes: 5_000_000_000,
        swapinsDelta: 12,
        swapoutsDelta: 3,
        pageinsDelta: 500,
        pageoutsDelta: 10,
      },
    });

    expect(sample.compressedBytes).toBe(2_000_000_000);
    expect(sample.pageinsDelta).toBe(500);
    expect(
      Buffer.byteLength(serializeDiagnosticSample(sample), "utf8"),
    ).toBeLessThanOrEqual(640);
  });
});
