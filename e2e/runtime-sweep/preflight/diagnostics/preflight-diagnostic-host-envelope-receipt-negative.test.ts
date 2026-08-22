import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  HOST_ENVELOPE_THRESHOLDS,
} from "./preflight-diagnostic-host-envelope.ts";
import {
  createDiagnosticHostEnvelopeReceipt,
  readHealthyPreResourceReceipt,
} from "./preflight-diagnostic-host-envelope-receipt.ts";

const healthySnapshot = (): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall: 1_700_000_000_000,
  phase: "pre-resource",
  rawFreeBytes: 6 * 1024 ** 3,
  availableBytes: 12 * 1024 ** 3,
  totalBytes: 36 * 1024 ** 3,
  compressedBytes: 4 * 1024 ** 3,
  swapUsedBytes: 256 * 1024 ** 2,
  swapFreeBytes: 4 * 1024 ** 3,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100,
  pageouts: 10,
  swapins: 20,
  swapouts: 30,
});

const receiptFixture = async (archiveRoot: string) => {
  const outputRoot = path.join(archiveRoot, "attempt");
  const sourceSha = "a".repeat(40);
  const sourceTree = "b".repeat(40);
  const campaignId = "cr-001-host-envelope-negative";
  const receipt = await createDiagnosticHostEnvelopeReceipt({
    archiveRoot,
    outputRoot,
    sourceSha,
    sourceTree,
    campaignId,
  });
  await receipt.record({
    snapshot: healthySnapshot(),
    status: "healthy",
    reasons: [],
    breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  });
  const paths = await receipt.finalize({
    status: "healthy",
    reason: "negative contract fixture",
  });
  return {
    paths,
    sourceSha,
    sourceTree,
    campaignId,
    readInput: {
      archiveRoot,
      manifestPath: paths.manifestPath,
      sourceSha,
      sourceTree,
      campaignId,
      expectedRecordCount: 1,
    },
  };
};

describe("diagnostic host envelope receipt negative contract", () => {
  it("rejects forged identity, digest, count, status and payload bounds", async () => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".host-envelope-negative-"),
    );
    try {
      const fixture = await receiptFixture(archiveRoot);
      const original = JSON.parse(
        await readFile(fixture.paths.manifestPath, "utf8"),
      ) as Record<string, unknown>;
      const writeManifest = (overrides: Record<string, unknown>) =>
        writeFile(
          fixture.paths.manifestPath,
          `${JSON.stringify({ ...original, ...overrides })}\n`,
          "utf8",
        );
      const expectIdentityFailure = (overrides: Record<string, unknown>) =>
        expect(
          writeManifest(overrides).then(() =>
            readHealthyPreResourceReceipt(fixture.readInput),
          ),
        ).rejects.toThrow("identity is invalid");
      await expectIdentityFailure({ sourceSha: "c".repeat(40) });
      await expectIdentityFailure({ campaignId: "other-campaign" });
      await expectIdentityFailure({ status: "inconclusive" });
      await expectIdentityFailure({ recordCount: 2 });
      await expect(
        writeManifest({ payloadDigest: "0".repeat(64) }).then(() =>
          readHealthyPreResourceReceipt(fixture.readInput),
        ),
      ).rejects.toThrow("does not match manifest");
      await expect(
        writeManifest({
          payloadBytes:
            HOST_ENVELOPE_THRESHOLDS.maxRecords *
              HOST_ENVELOPE_THRESHOLDS.maxRecordBytes +
            1,
        }).then(() => readHealthyPreResourceReceipt(fixture.readInput)),
      ).rejects.toThrow("exceeds byte bound");
    } finally {
      await rm(archiveRoot, { recursive: true, force: true });
    }
  });

  it("rejects an oversized record after bounded stat validation", async () => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".host-envelope-record-negative-"),
    );
    try {
      const fixture = await receiptFixture(archiveRoot);
      const oversizedPayload = `${"x".repeat(
        HOST_ENVELOPE_THRESHOLDS.maxRecordBytes,
      )}\n`;
      await writeFile(fixture.paths.recordsPath, oversizedPayload, "utf8");
      const manifest = JSON.parse(
        await readFile(fixture.paths.manifestPath, "utf8"),
      ) as Record<string, unknown>;
      await writeFile(
        fixture.paths.manifestPath,
        `${JSON.stringify({
          ...manifest,
          payloadBytes: Buffer.byteLength(oversizedPayload, "utf8"),
          payloadDigest: createHash("sha256")
            .update(oversizedPayload)
            .digest("hex"),
        })}\n`,
        "utf8",
      );
      await expect(
        readHealthyPreResourceReceipt(fixture.readInput),
      ).rejects.toThrow("record exceeds byte bound");
    } finally {
      await rm(archiveRoot, { recursive: true, force: true });
    }
  });
});
