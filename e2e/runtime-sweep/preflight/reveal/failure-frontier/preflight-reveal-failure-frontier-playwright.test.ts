import { describe, expect, it } from "vitest";

import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import type { BrowserPreflightHarness } from "../../execution/playwright-preflight.ts";
import { readRevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier.ts";
import { replayFailureFrontierWithBrowserHarness } from "./preflight-reveal-failure-frontier-playwright.ts";
import {
  createFailureFrontierPacket,
  failureFrontierCandidate,
  withFailureFrontierRoot,
} from "./preflight-reveal-failure-frontier-test-support.ts";

describe("focused Playwright failure-frontier replay", () => {
  it("establishes one fresh prepared boundary and never executes the final action", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const plan = makePlan();
      await createFailureFrontierPacket(packetRoot, plan);
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      const resets: boolean[] = [];
      const calls = { inventory: 0, execute: 0 };
      const harness: BrowserPreflightHarness = {
        expectedOrigin: "http://127.0.0.1:3105",
        prepare: (_state, _route, resetRequired) => {
          resets.push(resetRequired);
          return Promise.resolve();
        },
        navigate: () => Promise.resolve(),
        currentUrl: () => "http://127.0.0.1:3105/reports/active",
        inventory: () => {
          calls.inventory += 1;
          return Promise.resolve(packet.branch.inventory);
        },
        executeReveal: () => {
          calls.execute += 1;
          return Promise.reject(new Error("final action must not execute"));
        },
      };

      await expect(
        replayFailureFrontierWithBrowserHarness({ plan, packet, harness }),
      ).resolves.toBe("NOT_REPRODUCED");
      expect(resets).toEqual([true, false]);
      expect(calls).toEqual({ inventory: 2, execute: 0 });
      expect(packet.candidates[0]?.candidateId).toBeDefined();
      expect(failureFrontierCandidate.action.operation).toBe("click");
    });
  });
});
