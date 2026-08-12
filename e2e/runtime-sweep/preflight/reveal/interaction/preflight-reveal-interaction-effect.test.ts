import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import { discoverRevealControls } from "./preflight-reveal-discovery.ts";

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "interaction-effect-state",
  pairwiseDigest: "a".repeat(64),
  axes: {
    role: "head",
    route: "head:/admin/products",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

const select = (
  controlKey: string,
  accessibleName: string,
  interactionEffect: "client-only" | "mutation-required",
  order: number,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  order,
  role: "combobox",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "select",
  inputType: null,
  href: null,
  interactionEffect,
});

describe("preflight reveal interaction effects", () => {
  it("executes client-only selects and preserves mutating selects as matrix cells", async () => {
    const clientOnly = select("combobox:Filter:1", "Filter", "client-only", 1);
    const mutation = select(
      "combobox:Assign%20Testing:1",
      "Assign Testing",
      "mutation-required",
      2,
    );
    const inventory: DomInventory = {
      controls: [clientOnly, mutation],
      issues: [],
    };
    const executed = vi.fn<(controlKey: string) => void>();
    const controls = await discoverRevealControls({
      state,
      route: { resolvedRoute: "/admin/products" },
      initialInventory: inventory,
      harness: {
        prepare: () => Promise.resolve(),
        navigate: () => Promise.resolve(),
        currentUrl: () => "http://127.0.0.1:3305/admin/products",
        inventory: () => Promise.resolve(inventory),
        executeReveal: ({ control }) => {
          executed(control.controlKey);
          return Promise.resolve({
            url: "http://127.0.0.1:3305/admin/products",
            inventory,
            representativeInput: {
              kind: "select",
              value: "active",
              index: 1,
            },
            nonMutation: {
              status: "unchanged",
              beforeDigest: "d".repeat(64),
              afterDigest: "d".repeat(64),
            },
          });
        },
      },
      controlFor: preflightControlForPlan,
    });

    expect(executed.mock.calls).toEqual([[clientOnly.controlKey]]);
    const mutationCell = controls.find(
      ({ controlKey }) => controlKey === mutation.controlKey,
    );
    expect(mutationCell?.action).toMatchObject({ operation: "select" });
    expect(mutationCell?.expectedActionTransition).toBeNull();
  });
});
