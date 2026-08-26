import type { CampaignMatrixState } from "../../../../matrix/campaign-matrix.ts";
import { revealTransitionFor } from "../../../../matrix/reveal-transition.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../../replay/dom/dom-inventory.ts";
import {
  type RevealNonMutationProof,
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../../reveal-path.ts";
import { createRevealOperationRecorder } from "../evidence/preflight-reveal-operation-recorder.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
} from "../preflight-reveal-branches.ts";
import type { RevealExecutionHarness } from "../preflight-reveal-types.ts";
import { restoreRevealBranchLocally } from "./preflight-reveal-branch-local-restoration.ts";

const url = "/admin?tab=actions";
const DIGEST_LENGTH = 64;
const DOM_ORDER_WIDTH = 4;
export const liveUrl = `http://127.0.0.1:3205${url}`;
export const proof: RevealNonMutationProof = {
  status: "unchanged",
  beforeDigest: "d".repeat(DIGEST_LENGTH),
  afterDigest: "d".repeat(DIGEST_LENGTH),
};
const state: CampaignMatrixState = {
  profile: "demo",
  stateId: "branch-local-restoration-failure-test",
  pairwiseDigest: "a".repeat(DIGEST_LENGTH),
  axes: {
    role: "admin",
    route: "admin:/admin",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

const toggle = (
  target: string,
  expanded: boolean,
  order: number,
): DomControlObservation => {
  const accessibleName = expanded
    ? "Hide action details"
    : "Show action details";
  const controlKey = `button:${encodeURIComponent(accessibleName)}:${String(order + 1)}`;
  return {
    controlKey,
    domOrderKey: `${String(order).padStart(DOM_ORDER_WIDTH, "0")}:${controlKey}`,
    order,
    role: "button",
    accessibleName,
    enabled: true,
    disabled: false,
    visible: true,
    tagName: "button",
    inputType: null,
    href: null,
    ariaControls: target,
    ariaExpanded: expanded,
    disclosureIndependence: "source-bound-row-local",
  };
};

const inventoryFor = (expanded: readonly string[]): DomInventory => ({
  controls: ["row-a", "row-b"].map((target, order) =>
    toggle(target, expanded.includes(target), order),
  ),
  issues: [],
});

const actionFor = (control: DomControlObservation) => ({
  controlKey: control.controlKey,
  operation: "click" as const,
  safety: "read-only" as const,
  transition: "open" as const,
});

export const branchLocalFailureFixture = () => {
  const rootInventory = inventoryFor([]);
  const sourceInventory = inventoryFor(["row-a"]);
  const pairInventory = inventoryFor(["row-a", "row-b"]);
  const rootSurface = revealSurfaceFor(rootInventory.controls);
  const sourceSurface = revealSurfaceFor(sourceInventory.controls);
  const pairSurface = revealSurfaceFor(pairInventory.controls);
  const sourceControl = rootInventory.controls[0];
  const candidateControl = sourceInventory.controls[1];
  if (sourceControl === undefined || candidateControl === undefined)
    throw new Error("Failure fixture controls are missing");
  const sourceStep = revealStepFor(
    actionFor(sourceControl),
    rootSurface,
    sourceSurface,
    url,
    url,
    proof,
  );
  const source: RevealBranch = {
    path: revealPathFor([sourceStep], url),
    inventory: sourceInventory,
    surface: sourceSurface,
    url,
  };
  const candidate: RevealCandidate = {
    control: candidateControl,
    action: actionFor(candidateControl),
  };
  const pairStep = revealStepFor(
    candidate.action,
    sourceSurface,
    pairSurface,
    url,
    url,
    proof,
  );
  const pair: RevealBranch = {
    path: revealPathFor([sourceStep, pairStep], url),
    inventory: pairInventory,
    surface: pairSurface,
    url,
  };
  const terminal: RevealCandidateTerminalResult = {
    candidate,
    candidateIndex: 0,
    materialChanged: true,
    result: {
      branch: pair,
      explore: true,
      transition: revealTransitionFor(
        candidate.action,
        sourceSurface,
        pairSurface,
        url,
        url,
        proof,
        null,
      ),
    },
  };
  return { pairInventory, rootSurface, source, sourceInventory, terminal };
};

export const terminalWithInventory = (
  terminal: RevealCandidateTerminalResult,
  inventory: DomInventory,
): RevealCandidateTerminalResult => ({
  ...terminal,
  result: {
    ...terminal.result,
    branch: {
      ...terminal.result.branch,
      inventory,
      surface: revealSurfaceFor(inventory.controls),
    },
  },
});

export const restoreBranchLocallyForFailure = (
  harness: RevealExecutionHarness,
  input: ReturnType<typeof branchLocalFailureFixture>,
  terminal = input.terminal,
) => {
  const operationRecorder = createRevealOperationRecorder({
    childExecutionId: "e".repeat(DIGEST_LENGTH),
    childOrdinal: 0,
  });
  operationRecorder.recordCandidate({
    source: input.source,
    candidate: terminal.candidate,
  });
  return restoreRevealBranchLocally({
    context: {
      harness,
      state,
      route: { resolvedRoute: "/admin" },
      initialSurface: input.rootSurface,
      operationRecorder,
    },
    source: input.source,
    terminal,
  });
};

export const boundaryHarnessFor = (
  inventory: DomInventory,
): Omit<RevealExecutionHarness, "executeReveal"> => ({
  prepare: () => Promise.resolve(),
  navigate: () => Promise.resolve(),
  currentUrl: () => liveUrl,
  inventory: () => Promise.resolve(inventory),
});

export const unusedHarness = (): RevealExecutionHarness => ({
  ...boundaryHarnessFor({ controls: [], issues: [] }),
  executeReveal: () => Promise.reject(new Error("inverse must not start")),
});
