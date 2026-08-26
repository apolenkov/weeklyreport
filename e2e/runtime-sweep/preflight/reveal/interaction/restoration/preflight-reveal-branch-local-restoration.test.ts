import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../../matrix/campaign-matrix.ts";
import { revealTransitionFor } from "../../../../matrix/reveal-transition.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../../replay/dom/dom-inventory.ts";
import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
} from "../preflight-reveal-branches.ts";
import type { RevealExecutionHarness } from "../preflight-reveal-types.ts";
import {
  branchLocalInverseActionBudgetFor,
  canReuseRevealBranchForCandidate,
  restoreRevealBranchLocally,
} from "./preflight-reveal-branch-local-restoration.ts";

const url = "/admin?tab=actions";
const liveUrl = `http://127.0.0.1:3205${url}`;
const proof = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};
const state: CampaignMatrixState = {
  profile: "demo",
  stateId: "branch-local-restoration-test",
  pairwiseDigest: "a".repeat(64),
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

const toggle = (input: {
  readonly target: string;
  readonly expanded: boolean;
  readonly occurrence: number;
  readonly order: number;
}): DomControlObservation => {
  const name = input.expanded ? "Hide action details" : "Show action details";
  const controlKey = `button:${encodeURIComponent(name)}:${String(input.occurrence)}`;
  return {
    controlKey,
    domOrderKey: `${String(input.order).padStart(4, "0")}:${controlKey}`,
    order: input.order,
    role: "button",
    accessibleName: name,
    enabled: true,
    disabled: false,
    visible: true,
    tagName: "button",
    inputType: null,
    href: null,
    ariaControls: input.target,
    ariaExpanded: input.expanded,
    disclosureIndependence: "source-bound-row-local",
  };
};

const inventoryFor = (expanded: readonly string[]): DomInventory => {
  let showOccurrence = 0;
  let hideOccurrence = 0;
  return {
    controls: ["row-a", "row-b", "row-c"].map((target, order) => {
      const isExpanded = expanded.includes(target);
      const occurrence = isExpanded ? ++hideOccurrence : ++showOccurrence;
      return toggle({ target, expanded: isExpanded, occurrence, order });
    }),
    issues: [],
  };
};

const actionFor = (control: DomControlObservation) => ({
  controlKey: control.controlKey,
  operation: "click" as const,
  safety: "read-only" as const,
  transition: "open" as const,
});

const fixture = () => {
  const rootInventory = inventoryFor([]);
  const sourceInventory = inventoryFor(["row-a"]);
  const pairInventory = inventoryFor(["row-a", "row-b"]);
  const rootSurface = revealSurfaceFor(rootInventory.controls);
  const sourceSurface = revealSurfaceFor(sourceInventory.controls);
  const pairSurface = revealSurfaceFor(pairInventory.controls);
  const sourceControl = rootInventory.controls[0];
  const candidateControl = sourceInventory.controls[1];
  if (sourceControl === undefined || candidateControl === undefined)
    throw new Error("Restoration fixture controls are missing");
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
  return {
    candidate,
    pairInventory,
    rootSurface,
    source,
    sourceInventory,
    terminal,
  };
};

describe("branch-local inverse restoration", () => {
  it("restores the exact source branch by stable target identity", async () => {
    const { pairInventory, rootSurface, source, sourceInventory, terminal } =
      fixture();
    let currentInventory = pairInventory;
    const executeReveal = vi.fn<RevealExecutionHarness["executeReveal"]>(
      ({ action, control, executionKind }) => {
        expect(executionKind).toBe("replay");
        expect(control.ariaControls).toBe("row-b");
        expect(action.controlKey).toBe(control.controlKey);
        currentInventory = sourceInventory;
        return Promise.resolve({
          url: liveUrl,
          inventory: currentInventory,
          nonMutation: proof,
        });
      },
    );
    const harness: RevealExecutionHarness = {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => liveUrl,
      inventory: () => Promise.resolve(currentInventory),
      executeReveal,
    };

    await expect(
      restoreRevealBranchLocally({
        context: {
          harness,
          state,
          route: { resolvedRoute: "/admin" },
          initialSurface: rootSurface,
        },
        source,
        terminal,
      }),
    ).resolves.toMatchObject({
      inventory: sourceInventory,
      surface: source.surface,
      url,
    });
    expect(executeReveal).toHaveBeenCalledOnce();
  });

  it("rejects self and ordinary candidates but accepts a distinct peer", () => {
    const { candidate, source } = fixture();
    const self = source.inventory.controls[0];
    if (self === undefined) throw new Error("Self fixture is missing");
    const ordinary: RevealCandidate = {
      control: { ...candidate.control, disclosureIndependence: undefined },
      action: candidate.action,
    };

    expect(canReuseRevealBranchForCandidate(source, candidate)).toBe(true);
    expect(
      canReuseRevealBranchForCandidate(source, {
        control: self,
        action: actionFor(self),
      }),
    ).toBe(false);
    expect(canReuseRevealBranchForCandidate(source, ordinary)).toBe(false);
  });

  it("keeps the 20-toggle physical action count within the logical debit", () => {
    expect(
      branchLocalInverseActionBudgetFor({ depth: 1, candidateCount: 19 }),
    ).toEqual({ physical: 38, charged: 38 });
    expect(
      branchLocalInverseActionBudgetFor({ depth: 2, candidateCount: 19 }),
    ).toEqual({ physical: 39, charged: 57 });
    expect(() =>
      branchLocalInverseActionBudgetFor({ depth: 0, candidateCount: 19 }),
    ).toThrow(/positive integers/iu);
  });

  it("fails closed when inverse inventory does not exactly restore the source", async () => {
    const { pairInventory, rootSurface, source, sourceInventory, terminal } =
      fixture();
    let currentInventory = pairInventory;
    const drifted = { ...sourceInventory, visibleText: "drift" };
    const harness: RevealExecutionHarness = {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => liveUrl,
      inventory: () => Promise.resolve(currentInventory),
      executeReveal: () => {
        currentInventory = drifted;
        return Promise.resolve({
          url: liveUrl,
          inventory: currentInventory,
          nonMutation: proof,
        });
      },
    };

    await expect(
      restoreRevealBranchLocally({
        context: {
          harness,
          state,
          route: { resolvedRoute: "/admin" },
          initialSurface: rootSurface,
        },
        source,
        terminal,
      }),
    ).rejects.toThrow(/did not restore the exact source branch/iu);
  });
});
