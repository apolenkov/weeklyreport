import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import { revealPathFor, revealSurfaceFor } from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateFailure,
} from "../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../interaction/preflight-reveal-candidate-identity.ts";
import {
  captureRevealFailureFrontier,
  FAILURE_FRONTIER_MANIFEST_NAME,
  readRevealFailureFrontierPacket,
  replayRevealFailureFrontierBoundary,
} from "./preflight-reveal-failure-frontier.ts";

const candidate: RevealCandidate = {
  control: {
    controlKey: "button:failure-frontier:0",
    domOrderKey: "0000:button:failure-frontier:0",
    order: 0,
    role: "button",
    accessibleName: "Failure frontier",
    enabled: true,
    disabled: false,
    visible: true,
    tagName: "button",
    inputType: null,
    href: null,
  },
  action: {
    controlKey: "button:failure-frontier:0",
    operation: "click",
    safety: "read-only",
    transition: "open",
  },
};

const branchFor = (): RevealBranch => {
  const inventory = { controls: [candidate.control], issues: [] } as const;
  return {
    inventory,
    path: revealPathFor([], "/reports/active"),
    surface: revealSurfaceFor(inventory.controls),
    url: "/reports/active",
    preparation: undefined,
  };
};

const failureFor = (): RevealCandidateFailure => {
  const branch = branchFor();
  return {
    state: {
      queue: [],
      controls: [],
      discovered: new Map(),
      visitedStatePaths: new Map(),
      actionCount: 0,
      branchCount: 0,
      currentBranch: branch,
      currentCandidates: [candidate],
      currentCandidateIndex: 0,
    },
    branch,
    candidates: [candidate],
    candidateIndex: 0,
    candidateIdentity: revealCandidateIdentityFor({ branch, candidate }),
    originalError: new Error("terminal candidate failed"),
  };
};

const withPacketRoot = async (
  callback: (packetRoot: string) => Promise<void>,
): Promise<void> => {
  const packetRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "reveal-failure-frontier-")),
  );
  try {
    await callback(packetRoot);
  } finally {
    await rm(packetRoot, { recursive: true, force: true });
  }
};

describe("preflight reveal failure frontier", () => {
  it("publishes a source-bound diagnostic packet with its manifest last", async () => {
    await withPacketRoot(async (packetRoot) => {
      const plan = makePlan();
      const failure = failureFor();

      await captureRevealFailureFrontier({ packetRoot, plan, failure });
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });

      expect(packet.manifest).toMatchObject({
        artifact: "PREFLIGHT_REVEAL_FAILURE_FRONTIER",
        authority: "diagnostic-only",
        sourceSha: plan.sourceSha,
        capacityPlanArtifactDigest: plan.planArtifactDigest,
        candidateIndex: 0,
        candidateIdentity: failure.candidateIdentity,
        representativeInput: null,
      });
      expect(packet.branch.path.digest).toBe(failure.branch.path.digest);
      expect(packet.candidates).toHaveLength(1);
      expect(packet.candidates[0]?.candidateId).toBe(failure.candidateIdentity);
    });
  });

  it("rejects a mutated write-last manifest before hydration", async () => {
    await withPacketRoot(async (packetRoot) => {
      const plan = makePlan();
      await captureRevealFailureFrontier({
        packetRoot,
        plan,
        failure: failureFor(),
      });
      const manifestPath = path.join(
        packetRoot,
        FAILURE_FRONTIER_MANIFEST_NAME,
      );
      const manifest = JSON.parse(
        await readFile(manifestPath, "utf8"),
      ) as Record<string, unknown>;
      await writeFile(
        manifestPath,
        `${JSON.stringify({ ...manifest, candidateIndex: 1 })}\n`,
        "utf8",
      );

      await expect(
        readRevealFailureFrontierPacket({ packetRoot, expectedPlan: plan }),
      ).rejects.toThrow(/canonical|digest|candidate/iu);
    });
  });

  it("re-derives the exact candidate and checks the live boundary without executing it", async () => {
    await withPacketRoot(async (packetRoot) => {
      const plan = makePlan();
      await captureRevealFailureFrontier({
        packetRoot,
        plan,
        failure: failureFor(),
      });
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      const calls = { inventory: 0, execute: 0 };
      const classification = await replayRevealFailureFrontierBoundary({
        packet,
        state: plan.state,
        route: {
          resolvedRoute: "/reports/active",
          landingRoute: "/reports/active",
        },
        initialSurface: packet.branch.surface,
        candidatesFor: () => [candidate],
        harness: {
          prepare: () => Promise.resolve(),
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
        },
      });

      expect(classification).toBe("NOT_REPRODUCED");
      expect(calls).toEqual({ inventory: 2, execute: 0 });
    });
  });

  it("classifies an exact final-boundary mismatch without executing the action", async () => {
    await withPacketRoot(async (packetRoot) => {
      const plan = makePlan();
      await captureRevealFailureFrontier({
        packetRoot,
        plan,
        failure: failureFor(),
      });
      const packet = await readRevealFailureFrontierPacket({
        packetRoot,
        expectedPlan: plan,
      });
      const calls = { inventory: 0, execute: 0 };
      const classification = await replayRevealFailureFrontierBoundary({
        packet,
        state: plan.state,
        route: { resolvedRoute: "/reports/active" },
        initialSurface: packet.branch.surface,
        candidatesFor: () => [candidate],
        harness: {
          prepare: () => Promise.resolve(),
          navigate: () => Promise.resolve(),
          currentUrl: () => "http://127.0.0.1:3105/reports/active",
          inventory: () => {
            calls.inventory += 1;
            return Promise.resolve(
              calls.inventory === 1
                ? packet.branch.inventory
                : { controls: [], issues: [] },
            );
          },
          executeReveal: () => {
            calls.execute += 1;
            return Promise.reject(new Error("final action must not execute"));
          },
        },
      });

      expect(classification).toBe("REPRODUCED");
      expect(calls.execute).toBe(0);
    });
  });
});
