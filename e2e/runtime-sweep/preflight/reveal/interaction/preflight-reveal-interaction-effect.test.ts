import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { planLiveControlActions } from "../../../replay/live-control/live-control-planning.ts";
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

const disclosure = (
  controlKey: string,
  accessibleName: string,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `0001:${controlKey}`,
  order: 1,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const inventoryFor = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

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
        freezeRepresentativeInput: () =>
          Promise.resolve({ kind: "select", value: "active", index: 1 }),
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

describe("reveal branch restoration non-mutation boundary", () => {
  const route = { resolvedRoute: "/admin/products" } as const;
  const restorationFixture = () => {
    const collapse = disclosure(
      "button:Collapse%20Risks%20%26%20Blockers:1",
      "Collapse Risks & Blockers",
    );
    const expand = disclosure(
      "button:Expand%20Risks%20%26%20Blockers:1",
      "Expand Risks & Blockers",
    );
    const beforeInventory = inventoryFor([collapse]);
    const afterInventory = inventoryFor([expand]);
    const beforeSurface = revealSurfaceFor(beforeInventory.controls);
    const afterSurface = revealSurfaceFor(afterInventory.controls);
    const action = planLiveControlActions([collapse], {
      formSafety: "disposable-reset",
    })[0]?.action;
    if (action === undefined) throw new Error("Missing collapse action");
    const proof = {
      status: "unchanged" as const,
      beforeDigest: "d".repeat(64),
      afterDigest: "d".repeat(64),
    };
    const path = revealPathFor(
      [
        revealStepFor(
          action,
          beforeSurface,
          afterSurface,
          route.resolvedRoute,
          route.resolvedRoute,
          proof,
        ),
      ],
      route.resolvedRoute,
    );
    return {
      beforeInventory,
      beforeSurface,
      afterInventory,
      afterSurface,
      branch: {
        path,
        inventory: afterInventory,
        surface: afterSurface,
        url: route.resolvedRoute,
      },
    } as const;
  };

  const harnessFor = (
    fixture: ReturnType<typeof restorationFixture>,
    beforeDigest: string,
    afterDigest: string,
  ): RevealExecutionHarness => {
    const liveUrl = new URL(route.resolvedRoute, "http://127.0.0.1:3305").href;
    return {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => liveUrl,
      inventory: () => Promise.resolve(fixture.beforeInventory),
      executeReveal: () =>
        Promise.resolve({
          url: liveUrl,
          inventory: fixture.afterInventory,
          nonMutation: {
            status: "unchanged",
            beforeDigest,
            afterDigest,
          },
        }),
    };
  };

  it("accepts a fresh reseed proof that is locally unchanged", async () => {
    const fixture = restorationFixture();
    await expect(
      restoreRevealBranch({
        state,
        route,
        initialSurface: fixture.beforeSurface,
        branch: fixture.branch,
        harness: harnessFor(fixture, "e".repeat(64), "e".repeat(64)),
      }),
    ).resolves.toMatchObject({
      inventory: fixture.afterInventory,
      surface: fixture.afterSurface,
      url: route.resolvedRoute,
    });
  });

  it("rejects a fresh replay action that mutates its prepared database", async () => {
    const fixture = restorationFixture();
    await expect(
      restoreRevealBranch({
        state,
        route,
        initialSurface: fixture.beforeSurface,
        branch: fixture.branch,
        harness: harnessFor(fixture, "e".repeat(64), "f".repeat(64)),
      }),
    ).rejects.toThrow(/unchanged database-oracle proof/iu);
  });
});
