import { mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createDiagnosticSidecar } from "./preflight-diagnostic-sidecar.ts";
import {
  assertDiagnosticCampaignBinding,
  assertDiagnosticOutputPath,
  assertDiagnosticRecordBytes,
  DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS,
  type DiagnosticSample,
  parseDiagnosticSample,
  serializeDiagnosticSample,
} from "./preflight-diagnostic-sidecar-contract.ts";

const sampleFor = (
  overrides: Partial<DiagnosticSample> = {},
): DiagnosticSample => ({
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
  compressedBytes: 1000,
  swapTotalBytes: 7000,
  swapUsedBytes: 2000,
  swapFreeBytes: 5000,
  swapinsDelta: 0,
  swapoutsDelta: 0,
  pageinsDelta: 0,
  pageoutsDelta: 0,
  processRssBytes: 2000,
  processVsizeBytes: 4000,
  processFootprintBytes: 2500,
  cpuPercent: 1.5,
  traceRecords: 0,
  harEntries: 0,
  artifactBytes: 0,
  currentOperation: "none",
  failureKind: "none",
  ...overrides,
});

describe("diagnostic sidecar contract", () => {
  it("requires the requested campaign identity to match SOURCE.json", () => {
    expect(() =>
      assertDiagnosticCampaignBinding({
        requestedCampaignId: "campaign-other",
        sourceCampaignId: "campaign-source",
      }),
    ).toThrow("match SOURCE.json campaignId");
    expect(() =>
      assertDiagnosticCampaignBinding({
        requestedCampaignId: "campaign-source",
        sourceCampaignId: "campaign-source",
      }),
    ).not.toThrow();
  });

  it("rejects output roots that collide with acceptance artifacts", () => {
    const archiveRoot = path.join(tmpdir(), "diagnostic-archive");
    expect(() =>
      assertDiagnosticOutputPath({
        archiveRoot,
        outputRoot: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
      }),
    ).toThrow("acceptance artifact path");
    expect(() =>
      assertDiagnosticOutputPath({
        archiveRoot,
        outputRoot: path.join(archiveRoot, "PREFLIGHT_ASSIGNMENT.json"),
      }),
    ).toThrow("acceptance artifact path");
    expect(() =>
      assertDiagnosticOutputPath({
        archiveRoot,
        outputRoot: path.join(archiveRoot, "PREFLIGHT.journal.jsonl"),
      }),
    ).toThrow("acceptance artifact path");
    expect(() =>
      assertDiagnosticOutputPath({
        archiveRoot,
        outputRoot: path.join(archiveRoot, "segments", "diagnostic"),
      }),
    ).toThrow("acceptance artifact path");
  });
  it("rejects unknown roles and extra fields", () => {
    expect(() =>
      parseDiagnosticSample({
        ...sampleFor(),
        processRole: "utility",
      }),
    ).toThrow();
    expect(() =>
      parseDiagnosticSample({
        ...sampleFor(),
        cookie: "must-not-enter",
      }),
    ).toThrow();
  });

  it("counts the JSONL newline in the 640-byte record ceiling", () => {
    const maximumWidthSample = sampleFor({
      timestampWall: 253_402_300_799_999,
      processStartWall: 253_402_300_799_999,
      elapsedMs: 999_999_999,
      pid: 1_234_567_890,
      parentPid: 1_234_567_890,
      ownerRootPid: 1_234_567_890,
      hostTotalBytes: 99_999_999_999,
      hostFreeBytes: 88_888_888_888,
      compressedBytes: 99_999_999_999,
      swapTotalBytes: 99_999_999_999,
      swapUsedBytes: 99_999_999_999,
      swapFreeBytes: 99_999_999_999,
      swapinsDelta: 999_999_999,
      swapoutsDelta: 999_999_999,
      pageinsDelta: 999_999_999,
      pageoutsDelta: 999_999_999,
      processRssBytes: 9_999_999_999,
      processVsizeBytes: 9_999_999_999,
      processFootprintBytes: 9_999_999_999,
      cpuPercent: 999.99,
      traceRecords: 999_999_999,
      harEntries: 999_999_999,
      artifactBytes: 99_999_999_999,
      currentOperation: "cleanup",
      failureKind: "browser-disconnected",
    });
    const text = serializeDiagnosticSample(maximumWidthSample);
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(640);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('"cb":');
    expect(text).not.toContain('"compressedBytes"');
    expect(() => assertDiagnosticRecordBytes(`${"x".repeat(640)}\n`)).toThrow(
      "640-byte",
    );
  });

  it("is a no-op when diagnostic mode is disabled", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-off-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: false,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-off",
      });
      await sidecar.record(sampleFor());
      await expect(sidecar.finalize()).resolves.toBeUndefined();
      await expect(readdir(root)).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes a bounded archive-local sidecar and identity manifest", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-on-")),
    );
    const outputRoot = path.join(root, "sidecar");
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot,
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-on",
      });
      await sidecar.record(sampleFor());
      await sidecar.record(
        sampleFor({
          elapsedMs: 1000,
          stage: "failure",
          failureKind: "page-crash",
          currentOperation: "wait-reveal",
        }),
      );
      const manifest = await sidecar.finalize();
      if (manifest === undefined) throw new Error("manifest was not published");
      expect(manifest.sampleCount).toBe(2);
      expect(manifest.processSampleCounts).toEqual({
        "playwright-child": 2,
      });
      expect(manifest.processIdentitySampleCounts).toEqual({
        "playwright-child:101:1787399999000": 2,
      });
      expect(manifest.processCaptureStatus).toEqual({
        "playwright-child": "CAPTURED",
        browser: "NOT_CAPTURED",
        renderer: "NOT_CAPTURED",
      });
      expect(manifest.sourceSha).toBe("a".repeat(40));
      expect(manifest.sourceTree).toBe("b".repeat(40));

      const sidecarText = await readFile(manifest.sidecarPath, "utf8");
      expect(sidecarText).not.toContain("cookie");
      expect(sidecarText.trim().split("\n")).toHaveLength(2);
      await expect(readFile(manifest.manifestPath, "utf8")).resolves.toContain(
        '"artifact":"PREFLIGHT_DIAGNOSTIC_SIDECAR"',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed after the per-process sample bound", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-bound-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-bound",
      });
      for (
        let index = 0;
        index < DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS;
        index += 1
      )
        await sidecar.record(sampleFor({ elapsedMs: index * 1000 }));
      await expect(
        sidecar.record(
          sampleFor({ elapsedMs: DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS * 1000 }),
        ),
      ).rejects.toThrow("sample bound");
      await expect(sidecar.finalize()).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("allows at most the approved event-record bound", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-events-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-events",
      });
      for (let index = 0; index < 32; index += 1)
        await sidecar.record(
          sampleFor({
            recordKind: "event",
            elapsedMs: index,
            stage: "failure",
            failureKind: "page-crash",
          }),
        );
      await expect(
        sidecar.record(
          sampleFor({
            recordKind: "event",
            elapsedMs: 32,
            stage: "failure",
            failureKind: "page-crash",
          }),
        ),
      ).rejects.toThrow("event record bound");
      await expect(sidecar.finalize()).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("tracks no more than three owned process identities", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-processes-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-processes",
      });
      for (let pid = 101; pid <= 103; pid += 1)
        await sidecar.record(sampleFor({ pid }));
      await expect(sidecar.record(sampleFor({ pid: 104 }))).rejects.toThrow(
        "tracked-process bound",
      );
      await expect(sidecar.finalize()).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
