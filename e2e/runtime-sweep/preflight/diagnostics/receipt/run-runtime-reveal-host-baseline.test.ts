import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type { DiagnosticHostEnvelopeSnapshot } from "../preflight-diagnostic-host-envelope.ts";
import { createDiagnosticHostEnvelopeReceipt } from "../preflight-diagnostic-host-envelope-receipt.ts";
import { readHealthyPostInfrastructureReceipt } from "./preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";
import { collectRevealHostBaseline } from "./run-runtime-reveal-host-baseline.ts";

const SOURCE_SHA = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const CAMPAIGN_ID = "baseline-anchor-equivalence";
const HISTORICAL_SWAP_BYTES = 2 * 1024 ** 3;

const snapshotFor = (index: number): DiagnosticHostEnvelopeSnapshot => ({
  timestampWall: 1_700_000_000_000 + index,
  phase: "post-infrastructure",
  rawFreeBytes: 6 * 1024 ** 3,
  availableBytes: 12 * 1024 ** 3,
  totalBytes: 36 * 1024 ** 3,
  compressedBytes: 4 * 1024 ** 3,
  swapUsedBytes: HISTORICAL_SWAP_BYTES + index * 1024,
  swapFreeBytes: 4 * 1024 ** 3,
  pressureFreePercent: 80,
  pressureState: "normal",
  pageins: 100 + index,
  pageouts: 10 + index,
  swapins: 20 + index,
  swapouts: 30 + index,
});

describe("post-infrastructure baseline producer/reader anchor", () => {
  it("preserves the first accepted sample across all 60 records", async () => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".host-baseline-anchor-"),
    );
    try {
      const receipt = await createDiagnosticHostEnvelopeReceipt({
        archiveRoot,
        outputRoot: path.join(archiveRoot, "baseline"),
        sourceSha: SOURCE_SHA,
        sourceTree: SOURCE_TREE,
        campaignId: CAMPAIGN_ID,
      });
      let index = 0;
      await collectRevealHostBaseline({
        receipt,
        sample: () => Promise.resolve(snapshotFor(index++)),
        wait: () => Promise.resolve(),
      });
      const paths = await receipt.finalize({
        status: "healthy",
        reason: "producer reader anchor test",
      });
      const baseline = await readHealthyPostInfrastructureReceipt({
        archiveRoot,
        manifestPath: paths.manifestPath,
        sourceSha: SOURCE_SHA,
        sourceTree: SOURCE_TREE,
        campaignId: CAMPAIGN_ID,
      });

      expect(index).toBe(60);
      expect(baseline.firstSnapshot.swapUsedBytes).toBe(HISTORICAL_SWAP_BYTES);
      expect(baseline.lastSnapshot.swapUsedBytes).toBe(
        HISTORICAL_SWAP_BYTES + 59 * 1024,
      );
    } finally {
      await rm(archiveRoot, { recursive: true, force: true });
    }
  });
});
