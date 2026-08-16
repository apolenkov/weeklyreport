import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
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
});
