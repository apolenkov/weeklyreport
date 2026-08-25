import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { planLiveControlActions } from "../../../replay/live-control/live-control-planning.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "../interaction/preflight-reveal-discovery.ts";
import { classifyRevealTransition } from "../interaction/preflight-reveal-transition.ts";

const route = { resolvedRoute: "/lead/report?x=1&x=2" } as const;

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "fragment-link-state",
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

const skipToContent: DomControlObservation = {
  controlKey: "link:Skip to content:1",
  domOrderKey: "0001:link:Skip to content:1",
  order: 1,
  role: "link",
  accessibleName: "Skip to content",
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "a",
  inputType: null,
  href: "#main-content",
};

const inventory: DomInventory = { controls: [skipToContent], issues: [] };

describe("preflight same-document fragment links", () => {
  it("keeps Skip to content as a frozen action cell without reveal execution", async () => {
    const plan = planLiveControlActions(inventory.controls, {
      formSafety: "disposable-reset",
    })[0];
    if (plan === undefined)
      throw new Error("Skip to content fixture did not produce a plan");

    expect(classifyRevealTransition(plan, route)).toMatchObject({
      kind: "ordinary-control",
      action: { operation: "click" },
      reason:
        "Same-document fragment links remain ordinary frozen action cells, not reveal preparation",
    });

    const executeReveal = vi.fn<RevealExecutionHarness["executeReveal"]>(() =>
      Promise.reject(
        new Error("Same-document fragment must not be a reveal candidate"),
      ),
    );
    const controls = await discoverRevealControls({
      state,
      route,
      initialInventory: inventory,
      harness: {
        prepare: () => Promise.resolve(),
        navigate: () => Promise.resolve(),
        currentUrl: () =>
          new URL(route.resolvedRoute, "http://127.0.0.1:3205").href,
        inventory: () => Promise.resolve(inventory),
        executeReveal,
      },
      controlFor: preflightControlForPlan,
    });

    expect(executeReveal).not.toHaveBeenCalled();
    const frozenControl = controls.find(
      ({ controlKey }) => controlKey === skipToContent.controlKey,
    );
    expect(frozenControl?.action).toMatchObject({
      operation: "click",
      target: { role: "link", href: "#main-content" },
    });
    expect(frozenControl?.expectedActionTransition).toBeNull();
    expect(frozenControl?.revealPath.steps).toEqual([]);
  });
});
