import { describe, expect, it } from "vitest";

import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateFailure,
} from "../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../interaction/preflight-reveal-candidate-identity.ts";
import {
  captureRevealFailureFrontier,
  readRevealFailureFrontierPacket,
  replayRevealFailureFrontierBoundary,
} from "./preflight-reveal-failure-frontier.ts";
import { withFailureFrontierRoot } from "./preflight-reveal-failure-frontier-test-support.ts";

const DATABASE_DIGEST = "7".repeat(64);

const candidateFor = (
  key: string,
  name: string,
  order: number,
): RevealCandidate => ({
  control: {
    controlKey: key,
    domOrderKey: `${String(order).padStart(4, "0")}:${key}`,
    order,
    role: "button",
    accessibleName: name,
    enabled: true,
    disabled: false,
    visible: true,
    tagName: "button",
    inputType: null,
    href: null,
  },
  action: {
    controlKey: key,
    operation: "click",
    safety: "read-only",
    transition: "open",
  },
});

describe("failure-frontier candidate re-derivation", () => {
  it("applies the canonical immediate-reveal filter at a restored nested branch", async () => {
    await withFailureFrontierRoot(async (packetRoot) => {
      const oldCandidate = candidateFor("button:a-old:0", "Open old", 0);
      const newCandidate = candidateFor("button:b-new:1", "Open new", 1);
      const beforeInventory = {
        controls: [oldCandidate.control],
        issues: [],
      } as const;
      const afterInventory = {
        controls: [oldCandidate.control, newCandidate.control],
        issues: [],
      } as const;
      const beforeSurface = revealSurfaceFor(beforeInventory.controls);
      const afterSurface = revealSurfaceFor(afterInventory.controls);
      const proof = {
        status: "unchanged" as const,
        beforeDigest: DATABASE_DIGEST,
        afterDigest: DATABASE_DIGEST,
      };
      const branch: RevealBranch = {
        inventory: afterInventory,
        surface: afterSurface,
        url: "/reports/active",
        path: revealPathFor(
          [
            revealStepFor(
              oldCandidate.action,
              beforeSurface,
              afterSurface,
              "/reports/active",
              "/reports/active",
              proof,
            ),
          ],
          "/reports/active",
        ),
        preparation: undefined,
      };
      const failure: RevealCandidateFailure = {
        state: {
          queue: [],
          controls: [],
          discovered: new Map(),
          visitedStatePaths: new Map(),
          actionCount: 1,
          branchCount: 1,
          currentBranch: branch,
          currentCandidates: [newCandidate],
          currentCandidateIndex: 0,
        },
        branch,
        candidates: [newCandidate],
        candidateIndex: 0,
        candidateIdentity: revealCandidateIdentityFor({
          branch,
          candidate: newCandidate,
        }),
        originalError: new Error("nested candidate failed"),
      };
      const plan = makePlan();
      await captureRevealFailureFrontier({ packetRoot, plan, failure });
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      let inventory: typeof beforeInventory | typeof afterInventory =
        beforeInventory;
      let executions = 0;

      await expect(
        replayRevealFailureFrontierBoundary({
          packet,
          state: plan.state,
          route: {
            resolvedRoute: "/reports/active",
            landingRoute: "/reports/active",
          },
          initialSurface: beforeSurface,
          candidatesFor: () => [oldCandidate, newCandidate],
          harness: {
            prepare: () => {
              inventory = beforeInventory;
              return Promise.resolve();
            },
            navigate: () => Promise.resolve(),
            currentUrl: () => "http://127.0.0.1:3105/reports/active",
            inventory: () => Promise.resolve(inventory),
            executeReveal: () => {
              executions += 1;
              inventory = afterInventory;
              return Promise.resolve({
                url: "http://127.0.0.1:3105/reports/active",
                inventory,
                nonMutation: proof,
              });
            },
          },
        }),
      ).resolves.toBe("NOT_REPRODUCED");
      expect(executions).toBe(1);
    });
  });
});
