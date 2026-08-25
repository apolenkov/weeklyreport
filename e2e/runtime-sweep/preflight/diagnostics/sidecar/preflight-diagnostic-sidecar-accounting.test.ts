import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createDiagnosticSidecar } from "./preflight-diagnostic-sidecar.ts";
import { assertDiagnosticSidecarManifestAccounting } from "./preflight-diagnostic-sidecar-accounting.ts";
import type { DiagnosticSample } from "./preflight-diagnostic-sidecar-contract.ts";

const sample: DiagnosticSample = {
  recordKind: "sample",
  timestampWall: 1_787_400_000_000,
  elapsedMs: 0,
  stage: "launch",
  pid: 101,
  processRole: "playwright-child",
  processStartWall: 1_787_399_999_000,
  parentPid: null,
  ownerRootPid: 101,
  hostTotalBytes: 36_000,
  hostFreeBytes: 12_000,
  compressedBytes: null,
  swapTotalBytes: null,
  swapUsedBytes: null,
  swapFreeBytes: null,
  swapinsDelta: null,
  swapoutsDelta: null,
  pageinsDelta: null,
  pageoutsDelta: null,
  processRssBytes: 2000,
  processVsizeBytes: 4000,
  processFootprintBytes: null,
  cpuPercent: 1.5,
  traceRecords: null,
  harEntries: null,
  artifactBytes: null,
  currentOperation: "none",
  failureKind: "none",
};

describe("diagnostic sidecar read-back accounting", () => {
  it("rejects tampered digest, bytes, counts, aggregate, and capture status", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-accounting-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-accounting",
      });
      await sidecar.record(sample);
      const manifest = await sidecar.finalize();
      if (manifest === undefined) throw new Error("manifest was not published");
      const sidecarText = await readFile(manifest.sidecarPath, "utf8");
      const assertRejects = (
        overrides: Partial<typeof manifest>,
        text = sidecarText,
      ): void => {
        expect(() =>
          assertDiagnosticSidecarManifestAccounting({
            manifest: { ...manifest, ...overrides },
            sidecarText: text,
          }),
        ).toThrow();
      };
      assertRejects({}, sidecarText.replace('"elapsedMs":0', '"elapsedMs":1'));
      assertRejects({ sidecarBytes: manifest.sidecarBytes + 1 });
      assertRejects({ manifestBytes: manifest.manifestBytes + 1 });
      assertRejects({ aggregateBytes: manifest.aggregateBytes + 1 });
      assertRejects({ sampleCount: manifest.sampleCount + 1 });
      assertRejects({
        processCaptureStatus: {
          ...manifest.processCaptureStatus,
          browser: "CAPTURED",
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
