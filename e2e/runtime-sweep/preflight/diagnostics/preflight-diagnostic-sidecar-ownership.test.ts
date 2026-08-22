import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { diagnosticProcessRoleFor } from "./preflight-diagnostic-processes.ts";
import { createDiagnosticSidecar } from "./preflight-diagnostic-sidecar.ts";
import {
  type DiagnosticSample,
  parseDiagnosticSample,
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

describe("diagnostic sidecar process ownership", () => {
  it("does not promote renderer or utility descendants to owned roles", () => {
    expect(
      diagnosticProcessRoleFor("chrome-headless-shell --type=renderer", 2),
    ).toBeUndefined();
    expect(
      diagnosticProcessRoleFor("chrome-headless-shell --type=utility", 1),
    ).toBeUndefined();
    expect(diagnosticProcessRoleFor("chrome-headless-shell", 1)).toBe(
      "browser",
    );
  });

  it("rejects mixed canonical and compact wire keys", () => {
    expect(() =>
      parseDiagnosticSample({
        ...sampleFor(),
        cb: null,
      }),
    ).toThrow("mix compact and canonical");
  });

  it("rejects a reused identity with changed ownership metadata", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-identity-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-identity",
      });
      await sidecar.record(sampleFor());
      await expect(
        sidecar.record(sampleFor({ parentPid: 202 })),
      ).rejects.toThrow("identity changed");
      await expect(sidecar.finalize()).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks proven Chromium ownership separately from NOT_CAPTURED", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-captured-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-captured",
      });
      await sidecar.record(
        sampleFor({
          pid: 202,
          processRole: "browser",
          parentPid: 101,
          ownerRootPid: 101,
        }),
      );
      const manifest = await sidecar.finalize();
      if (manifest === undefined) throw new Error("manifest was not published");
      expect(manifest.processCaptureStatus).toEqual({
        "playwright-child": "NOT_CAPTURED",
        browser: "CAPTURED",
        renderer: "NOT_CAPTURED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects renderer samples without a page-bound proof", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "diagnostic-sidecar-renderer-")),
    );
    try {
      const sidecar = createDiagnosticSidecar({
        enabled: true,
        archiveRoot: root,
        outputRoot: path.join(root, "sidecar"),
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        campaignId: "campaign-renderer",
      });
      await expect(
        sidecar.record(
          sampleFor({
            pid: 303,
            processRole: "renderer",
            parentPid: 202,
            ownerRootPid: 101,
          }),
        ),
      ).rejects.toThrow("page-bound process proof");
      await expect(sidecar.finalize()).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
