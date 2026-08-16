import { readFile, symlink, unlink, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  FAILURE_FRONTIER_LIMITS,
  readRevealFailureFrontierPacket,
} from "./preflight-reveal-failure-frontier.ts";
import { classifyFailureFrontierReplay } from "./preflight-reveal-failure-frontier-classification.ts";
import {
  assetPathFor,
  createFailureFrontierPacket,
  manifestPathFor,
  readFailureFrontierManifest,
  withFailureFrontierRoot,
} from "./preflight-reveal-failure-frontier-test-support.ts";

const expectPacketRejection = async (
  packetRoot: string,
  plan: Awaited<ReturnType<typeof createFailureFrontierPacket>>,
): Promise<void> => {
  await expect(
    readRevealFailureFrontierPacket({ packetRoot, expectedPlan: plan }),
  ).rejects.toThrow();
};

const expectInvalidPacketClassification = async (
  packetRoot: string,
  plan: Awaited<ReturnType<typeof createFailureFrontierPacket>>,
): Promise<void> => {
  await expect(
    classifyFailureFrontierReplay({
      validate: async () => ({
        source: {} as never,
        plan,
        packet: await readRevealFailureFrontierPacket({
          packetRoot,
          expectedPlan: plan,
        }),
      }),
      replay: () => Promise.resolve("NOT_REPRODUCED"),
    }),
  ).resolves.toBe("INVALID_PACKET");
};

describe("failure-frontier bounded IO rejection", () => {
  it("rejects a missing manifest", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      await unlink(manifestPathFor(packetRoot));
      await expectInvalidPacketClassification(packetRoot, plan);
    });
  });

  it("rejects a partial or oversized manifest", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      const manifestPath = manifestPathFor(packetRoot);
      const valid = await readFile(manifestPath, "utf8");
      await writeFile(manifestPath, valid.slice(0, -1), "utf8");
      await expectPacketRejection(packetRoot, plan);
      await writeFile(
        manifestPath,
        Buffer.alloc(FAILURE_FRONTIER_LIMITS.maxManifestBytes + 1, 120),
      );
      await expectPacketRejection(packetRoot, plan);
    });
  });

  it("rejects a symlinked manifest", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      const manifestPath = manifestPathFor(packetRoot);
      const target = path.join(packetRoot, "manifest-target.json");
      await writeFile(target, await readFile(manifestPath));
      await unlink(manifestPath);
      await symlink(target, manifestPath);
      await expectPacketRejection(packetRoot, plan);
    });
  });

  it("rejects a missing, tampered, or symlinked asset", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      const manifest = await readFailureFrontierManifest(packetRoot);
      const descriptor = manifest.assets[0];
      expect(descriptor).toBeDefined();
      if (descriptor === undefined) return;
      const assetPath = assetPathFor(packetRoot, descriptor);
      const original = await readFile(assetPath);

      await unlink(assetPath);
      await expectInvalidPacketClassification(packetRoot, plan);

      await writeFile(assetPath, "{}\n", "utf8");
      await expectInvalidPacketClassification(packetRoot, plan);

      const target = path.join(packetRoot, "asset-target.json");
      await writeFile(target, original);
      await unlink(assetPath);
      await symlink(target, assetPath);
      await expectPacketRejection(packetRoot, plan);
    });
  });
});
