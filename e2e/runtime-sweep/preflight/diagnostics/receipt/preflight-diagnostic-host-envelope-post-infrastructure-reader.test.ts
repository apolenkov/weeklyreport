import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
} from "../preflight-diagnostic-host-envelope.ts";
import { createDiagnosticHostEnvelopeReceipt } from "../preflight-diagnostic-host-envelope-receipt.ts";
import { readHealthyPostInfrastructureReceipt } from "./preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";

const sourceSha = "a".repeat(40);
const sourceTree = "b".repeat(40);
const campaignId = "cr-001-post-infrastructure-reader";

const snapshotFor = (index: number): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall: 1_700_000_000_000 + index,
  phase: "post-infrastructure",
  rawFreeBytes: 0,
  availableBytes: 12 * 1024 ** 3,
  totalBytes: 36 * 1024 ** 3,
  compressedBytes: 4 * 1024 ** 3,
  swapUsedBytes: 256 * 1024 ** 2,
  swapFreeBytes: 4 * 1024 ** 3,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100 + index,
  pageouts: 10 + index,
  swapins: 20 + index,
  swapouts: 30 + index,
});

const withReceipt = async (
  callback: (input: {
    readonly archiveRoot: string;
    readonly manifestPath: string;
    readonly recordsPath: string;
  }) => Promise<void>,
): Promise<void> => {
  const archiveRoot = await mkdtemp(
    path.join(process.cwd(), ".post-infrastructure-reader-"),
  );
  try {
    const outputRoot = path.join(archiveRoot, "baseline");
    const receipt = await createDiagnosticHostEnvelopeReceipt({
      archiveRoot,
      outputRoot,
      sourceSha,
      sourceTree,
      campaignId,
    });
    for (let index = 0; index < 60; index += 1)
      await receipt.record({
        snapshot: snapshotFor(index),
        status: "healthy",
        reasons: [],
        breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
      });
    const paths = await receipt.finalize({ status: "healthy", reason: "test" });
    await callback({ archiveRoot, ...paths });
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
};

describe("strict post-infrastructure host checkpoint baseline reader", () => {
  it("accepts exactly 60 healthy source-bound records and returns a digest", async () => {
    await withReceipt(async (input) => {
      const baseline = await readHealthyPostInfrastructureReceipt({
        archiveRoot: input.archiveRoot,
        manifestPath: input.manifestPath,
        sourceSha,
        sourceTree,
        campaignId,
      });
      expect(baseline.recordCount).toBe(60);
      expect(baseline.baselineReceiptDigest).toMatch(/^[0-9a-f]{64}$/u);
      expect(baseline.lastSnapshot.timestampWall).toBe(1_700_000_000_059);
      expect(baseline.lastCounters.pageins).toBe(159);
    });
  });

  it.each([
    ["sourceSha", { sourceSha: "c".repeat(40) }, "identity"],
    ["recordCount", { recordCount: 59 }, "identity"],
    ["status", { status: "inconclusive" }, "identity"],
  ] as const)(
    "rejects manifest %s drift",
    async (_name, overrides, message) => {
      await withReceipt(async (input) => {
        const original = JSON.parse(
          await readFile(input.manifestPath, "utf8"),
        ) as Record<string, unknown>;
        await writeFile(
          input.manifestPath,
          `${JSON.stringify({ ...original, ...overrides })}\n`,
          { mode: 0o600 },
        );
        await expect(
          readHealthyPostInfrastructureReceipt({
            archiveRoot: input.archiveRoot,
            manifestPath: input.manifestPath,
            sourceSha,
            sourceTree,
            campaignId,
          }),
        ).rejects.toThrow(message);
      });
    },
  );

  it("rejects a pre-resource phase, non-monotone counters, and unsafe file modes", async () => {
    await withReceipt(async (input) => {
      const payload = (await readFile(input.recordsPath, "utf8"))
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const firstRecord = payload[0];
      if (firstRecord === undefined)
        throw new Error("Fixture payload is empty");
      firstRecord.p = "pre-resource";
      const rewrittenPayload = payload
        .map((record) => `${JSON.stringify(record)}\n`)
        .join("");
      await writeFile(input.recordsPath, rewrittenPayload, { mode: 0o600 });
      const manifest = JSON.parse(
        await readFile(input.manifestPath, "utf8"),
      ) as Record<string, unknown>;
      manifest.payloadBytes = (await readFile(input.recordsPath)).byteLength;
      const bytes = await readFile(input.recordsPath);
      manifest.payloadDigest = (await import("node:crypto"))
        .createHash("sha256")
        .update(bytes)
        .digest("hex");
      await writeFile(input.manifestPath, `${JSON.stringify(manifest)}\n`, {
        mode: 0o600,
      });
      await expect(
        readHealthyPostInfrastructureReceipt({
          archiveRoot: input.archiveRoot,
          manifestPath: input.manifestPath,
          sourceSha,
          sourceTree,
          campaignId,
        }),
      ).rejects.toThrow(/healthy post-infrastructure/u);
      await chmod(input.manifestPath, 0o644);
      await expect(
        readHealthyPostInfrastructureReceipt({
          archiveRoot: input.archiveRoot,
          manifestPath: input.manifestPath,
          sourceSha,
          sourceTree,
          campaignId,
        }),
      ).rejects.toThrow(/mode 0600/u);
    });
  });

  it("rejects nonempty reasons or breach streaks in a healthy baseline", async () => {
    await withReceipt(async (input) => {
      const payload = (await readFile(input.recordsPath, "utf8"))
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const firstRecord = payload[0];
      if (firstRecord === undefined)
        throw new Error("Fixture payload is empty");
      firstRecord.r = ["tampered"];
      firstRecord.k = [0, 0, 0, 1];
      const rewrittenPayload = payload
        .map((record) => `${JSON.stringify(record)}\n`)
        .join("");
      await writeFile(input.recordsPath, rewrittenPayload, { mode: 0o600 });
      const manifest = JSON.parse(
        await readFile(input.manifestPath, "utf8"),
      ) as Record<string, unknown>;
      manifest.payloadBytes = rewrittenPayload.length;
      const bytes = Buffer.from(rewrittenPayload, "utf8");
      manifest.payloadDigest = (await import("node:crypto"))
        .createHash("sha256")
        .update(bytes)
        .digest("hex");
      await writeFile(input.manifestPath, `${JSON.stringify(manifest)}\n`, {
        mode: 0o600,
      });
      await expect(
        readHealthyPostInfrastructureReceipt({
          archiveRoot: input.archiveRoot,
          manifestPath: input.manifestPath,
          sourceSha,
          sourceTree,
          campaignId,
        }),
      ).rejects.toThrow(/reasons are invalid/u);
    });
  });

  it("rejects a symlinked records file", async () => {
    await withReceipt(async (input) => {
      const linked = path.join(input.archiveRoot, "linked-records.jsonl");
      await symlink(input.recordsPath, linked);
      const manifest = JSON.parse(
        await readFile(input.manifestPath, "utf8"),
      ) as Record<string, unknown>;
      manifest.recordsPath = linked;
      await writeFile(input.manifestPath, `${JSON.stringify(manifest)}\n`, {
        mode: 0o600,
      });
      await expect(
        readHealthyPostInfrastructureReceipt({
          archiveRoot: input.archiveRoot,
          manifestPath: input.manifestPath,
          sourceSha,
          sourceTree,
          campaignId,
        }),
      ).rejects.toThrow();
    });
  });
});
