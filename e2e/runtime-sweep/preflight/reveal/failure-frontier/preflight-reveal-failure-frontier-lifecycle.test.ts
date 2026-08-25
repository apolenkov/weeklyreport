import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import {
  assertFailureFrontierManifestAbsent,
  createRevealFailureFrontierHandler,
  readRevealFailureFrontierPacket,
} from "./preflight-reveal-failure-frontier.ts";
import {
  createFailureFrontierPacket,
  failureFrontierFailure,
  withFailureFrontierRoot,
} from "./preflight-reveal-failure-frontier-test-support.ts";

describe("failure-frontier lifecycle", () => {
  it("captures only the first terminal-candidate failure", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = makePlan();
      const handler = createRevealFailureFrontierHandler({
        packetRoot,
        plan,
        beforeCapture: () => Promise.resolve(),
      });
      const first = failureFrontierFailure();
      await handler(first);
      await handler({
        ...failureFrontierFailure(),
        candidateIdentity: "0".repeat(64),
        originalError: new Error("second failure must be ignored"),
      });

      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      expect(packet.manifest.candidateIdentity).toBe(first.candidateIdentity);
      expect(packet.manifest.failure.messageDigest).toBe(
        sha256Hex("terminal candidate failed"),
      );
    });
  });

  it("refuses a pre-existing manifest before a new capture attempt", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      await expect(
        assertFailureFrontierManifestAbsent(packetRoot),
      ).resolves.toBeUndefined();
      await createFailureFrontierPacket(packetRoot);
      await expect(
        assertFailureFrontierManifestAbsent(packetRoot),
      ).rejects.toThrow(/manifest already exists/iu);
    });
  });

  it("runs the exact-source gate before creating any packet content", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const sourceDrift = new Error("live source drifted");
      const handler = createRevealFailureFrontierHandler({
        packetRoot,
        plan: makePlan(),
        beforeCapture: () => Promise.reject(sourceDrift),
      });

      await expect(handler(failureFrontierFailure())).rejects.toBe(sourceDrift);
      await expect(
        assertFailureFrontierManifestAbsent(packetRoot),
      ).resolves.toBeUndefined();
    });
  });
});
