import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import { restoreRevealBranch } from "./preflight-reveal-branch-execution.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "./preflight-reveal-discovery.ts";

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "branch-execution-test-state",
  pairwiseDigest: "a".repeat(64),
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};
const route = { resolvedRoute: "/lead/report" } as const;
const control: DomControlObservation = {
  controlKey: "button:Open:1",
  domOrderKey: "0001:button:Open:1",
  order: 1,
  role: "button",
  accessibleName: "Open",
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
};
const inventory: DomInventory = { controls: [control], issues: [] };

describe("preflight reveal branch execution", () => {
  it("rejects an off-route reset before reading its inventory", async () => {
    const readInventory = vi.fn(() => Promise.resolve(inventory));
    const harness: RevealExecutionHarness = {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => "http://127.0.0.1:3205/login?next=/lead/report",
      inventory: readInventory,
      executeReveal: () => Promise.reject(new Error("not expected")),
    };

    await expect(
      discoverRevealControls({
        state,
        route,
        initialInventory: inventory,
        harness,
        controlFor: preflightControlForPlan,
      }),
    ).rejects.toThrow(/left nominal route pathname/iu);
    expect(readInventory).not.toHaveBeenCalled();
  });

  it("re-reads the replay inventory after semantic surface readiness", async () => {
    const restore = async (
      populateAfterReadiness: boolean,
      executionInventory: DomInventory = { controls: [], issues: [] },
    ) => {
      const afterControl: DomControlObservation = {
        ...control,
        accessibleName: "Close",
        controlKey: "button:Close:1",
        domOrderKey: "0001:button:Close:1",
      };
      const rootInventory = inventory;
      const afterInventory: DomInventory = {
        controls: [afterControl],
        issues: [],
      };
      const rootSurface = revealSurfaceFor(rootInventory.controls);
      const afterSurface = revealSurfaceFor(afterInventory.controls);
      const proof = {
        status: "unchanged" as const,
        beforeDigest: "a".repeat(64),
        afterDigest: "a".repeat(64),
      };
      const path = revealPathFor(
        [
          revealStepFor(
            {
              controlKey: control.controlKey,
              operation: "click",
              safety: "read-only",
              transition: "open",
            },
            rootSurface,
            afterSurface,
            "/lead/report",
            "/lead/report",
            proof,
          ),
        ],
        "/lead/report",
      );
      let currentInventory = rootInventory;
      const waitForRevealSurfaceReady = vi.fn(() => {
        if (populateAfterReadiness) currentInventory = afterInventory;
        return Promise.resolve();
      });
      const harness: RevealExecutionHarness = {
        prepare: () => Promise.resolve(),
        navigate: () => {
          currentInventory = rootInventory;
          return Promise.resolve();
        },
        currentUrl: () => "https://runtime.invalid/lead/report",
        inventory: () => Promise.resolve(currentInventory),
        waitForRevealSurfaceReady,
        executeReveal: () => {
          currentInventory = executionInventory;
          return Promise.resolve({
            url: "https://runtime.invalid/lead/report",
            inventory: currentInventory,
            nonMutation: proof,
          });
        },
      };

      const restored = await restoreRevealBranch({
        harness,
        state,
        route,
        initialSurface: rootSurface,
        branch: {
          path,
          inventory: afterInventory,
          surface: afterSurface,
          url: "/lead/report",
        },
      });
      return {
        afterInventory,
        afterSurface,
        restored,
        waitForRevealSurfaceReady,
      };
    };

    await expect(restore(false)).rejects.toThrow(
      "Reveal path after surface drifted",
    );
    const {
      afterInventory,
      afterSurface,
      restored,
      waitForRevealSurfaceReady,
    } = await restore(true);

    expect(waitForRevealSurfaceReady).toHaveBeenCalledOnce();
    expect(waitForRevealSurfaceReady).toHaveBeenCalledWith(
      afterSurface,
      revealSurfaceFor({ controls: [], issues: [] }.controls),
    );
    expect(restored.surface).toEqual(afterSurface);
    expect(restored.inventory).toEqual(afterInventory);

    const exact = await restore(false, afterInventory);
    expect(exact.waitForRevealSurfaceReady).not.toHaveBeenCalled();
    expect(exact.restored.surface).toEqual(afterSurface);
    expect(exact.restored.inventory).toEqual(afterInventory);
  });
});
