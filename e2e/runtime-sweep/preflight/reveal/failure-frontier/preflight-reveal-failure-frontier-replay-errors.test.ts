import { describe, expect, it } from "vitest";

import {
  readRevealFailureFrontierPacket,
  replayRevealFailureFrontierBoundary,
} from "./preflight-reveal-failure-frontier.ts";
import {
  createFailureFrontierPacket,
  failureFrontierCandidate,
  withFailureFrontierRoot,
} from "./preflight-reveal-failure-frontier-test-support.ts";

describe("failure-frontier replay error classification", () => {
  it("propagates a generic restore infrastructure failure", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      const infrastructureFailure = new Error(
        "browser navigation disconnected",
      );

      await expect(
        replayRevealFailureFrontierBoundary({
          packet,
          state: plan.state,
          route: { resolvedRoute: "/reports/active" },
          initialSurface: packet.branch.surface,
          candidatesFor: () => [failureFrontierCandidate],
          harness: {
            prepare: () => Promise.reject(infrastructureFailure),
            navigate: () => Promise.resolve(),
            currentUrl: () => "http://127.0.0.1:3105/reports/active",
            inventory: () => Promise.resolve(packet.branch.inventory),
            executeReveal: () =>
              Promise.reject(new Error("final action must not execute")),
          },
        }),
      ).rejects.toBe(infrastructureFailure);
    });
  });

  it("propagates a generic final-boundary inventory failure", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = await createFailureFrontierPacket(packetRoot);
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      const infrastructureFailure = new Error("inventory adapter disconnected");
      let inventoryCalls = 0;
      let executeCalls = 0;

      await expect(
        replayRevealFailureFrontierBoundary({
          packet,
          state: plan.state,
          route: { resolvedRoute: "/reports/active" },
          initialSurface: packet.branch.surface,
          candidatesFor: () => [failureFrontierCandidate],
          harness: {
            prepare: () => Promise.resolve(),
            navigate: () => Promise.resolve(),
            currentUrl: () => "http://127.0.0.1:3105/reports/active",
            inventory: () => {
              inventoryCalls += 1;
              return inventoryCalls === 1
                ? Promise.resolve(packet.branch.inventory)
                : Promise.reject(infrastructureFailure);
            },
            executeReveal: () => {
              executeCalls += 1;
              return Promise.reject(new Error("final action must not execute"));
            },
          },
        }),
      ).rejects.toBe(infrastructureFailure);
      expect(executeCalls).toBe(0);
    });
  });
});
