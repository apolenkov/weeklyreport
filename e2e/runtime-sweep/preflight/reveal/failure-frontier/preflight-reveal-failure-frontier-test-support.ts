import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type { CapacitySurveyPlan } from "../../capacity/preflight-capacity-survey-contract.ts";
import { makePlan } from "../../capacity/preflight-capacity-survey-test-support.ts";
import { revealPathFor, revealSurfaceFor } from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateFailure,
} from "../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../interaction/preflight-reveal-candidate-identity.ts";
import {
  FAILURE_FRONTIER_MANIFEST_NAME,
  parseRevealFailureFrontierManifest,
  type RevealFailureFrontierAssetDescriptor,
  type RevealFailureFrontierManifest,
} from "./preflight-reveal-failure-frontier-contract.ts";
import { captureRevealFailureFrontier } from "./preflight-reveal-failure-frontier-io.ts";

export const failureFrontierCandidate: RevealCandidate = {
  control: {
    controlKey: "button:failure-frontier:0",
    domOrderKey: "0000:button:failure-frontier:0",
    order: 0,
    role: "button",
    accessibleName: "Open failure frontier",
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

export const failureFrontierBranch = (): RevealBranch => {
  const inventory = {
    controls: [failureFrontierCandidate.control],
    issues: [],
  } as const;
  return {
    inventory,
    path: revealPathFor([], "/reports/active"),
    surface: revealSurfaceFor(inventory.controls),
    url: "/reports/active",
    preparation: undefined,
  };
};

export const failureFrontierFailure = (): RevealCandidateFailure => {
  const branch = failureFrontierBranch();
  return {
    state: {
      queue: [],
      controls: [],
      discovered: new Map(),
      visitedStatePaths: new Map(),
      actionCount: 0,
      branchCount: 0,
      currentBranch: branch,
      currentCandidates: [failureFrontierCandidate],
      currentCandidateIndex: 0,
    },
    branch,
    candidates: [failureFrontierCandidate],
    candidateIndex: 0,
    candidateIdentity: revealCandidateIdentityFor({
      branch,
      candidate: failureFrontierCandidate,
    }),
    originalError: new Error("terminal candidate failed"),
  };
};

export const withFailureFrontierRoot = async (
  callback: (packetRoot: string) => Promise<void>,
): Promise<void> => {
  const packetRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "reveal-failure-frontier-negative-")),
  );
  try {
    await callback(packetRoot);
  } finally {
    await rm(packetRoot, { recursive: true, force: true });
  }
};

export const manifestPathFor = (packetRoot: string): string =>
  path.join(packetRoot, FAILURE_FRONTIER_MANIFEST_NAME);

export const readFailureFrontierManifest = async (
  packetRoot: string,
): Promise<RevealFailureFrontierManifest> =>
  parseRevealFailureFrontierManifest(
    JSON.parse(await readFile(manifestPathFor(packetRoot), "utf8")),
  );

type FailureFrontierManifestBody = Omit<
  RevealFailureFrontierManifest,
  "manifestDigest"
>;

export const manifestValueFor = (body: FailureFrontierManifestBody) => ({
  ...body,
  manifestDigest: sha256Hex(body),
});

export const rewriteFailureFrontierManifest = async (
  packetRoot: string,
  mutate: (body: FailureFrontierManifestBody) => FailureFrontierManifestBody,
): Promise<void> => {
  const manifest = await readFailureFrontierManifest(packetRoot);
  const { manifestDigest: _manifestDigest, ...body } = manifest;
  await writeFile(
    manifestPathFor(packetRoot),
    `${stableSerialize(manifestValueFor(mutate(body)))}\n`,
    "utf8",
  );
};

export const assetPathFor = (
  packetRoot: string,
  descriptor: RevealFailureFrontierAssetDescriptor,
): string =>
  path.join(
    packetRoot,
    "continuation",
    "assets",
    descriptor.artifact.toLowerCase(),
    `${descriptor.ref}.json`,
  );

export const createFailureFrontierPacket = async (
  packetRoot: string,
  plan: CapacitySurveyPlan = makePlan(),
): Promise<CapacitySurveyPlan> => {
  await captureRevealFailureFrontier({
    packetRoot,
    plan,
    failure: failureFrontierFailure(),
  });
  return plan;
};
