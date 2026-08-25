import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import { assertControlTransition } from "../../../matrix/policy/matrix-preflight-transition-validation.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { planLiveControlActions } from "../../../replay/live-control/live-control-planning.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import { revealPathFor, revealSurfaceFor } from "../../reveal-path.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "./preflight-reveal-discovery.ts";
import {
  classifyRevealTransition,
  representativeInputFor,
} from "./preflight-reveal-transition.ts";

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "transition-test-state",
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
const proof = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const absoluteBrowserUrl = (route: string): string =>
  new URL(route, "http://127.0.0.1:3205").href;

const control = (
  controlKey: string,
  accessibleName: string,
  options: Readonly<Partial<DomControlObservation>> = {},
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
  ...options,
});

const inventory = (
  controls: readonly DomControlObservation[],
): DomInventory => ({
  controls,
  issues: [],
});

const planFor = (entry: DomControlObservation) => {
  const plan = planLiveControlActions([entry], {
    formSafety: "disposable-reset",
  })[0];
  if (plan === undefined)
    throw new Error(`No action plan for ${entry.controlKey}`);
  return plan;
};
describe("preflight reveal transition classification", () => {
  it("classifies Search Reports, Filter, and Status as deterministic client forms", () => {
    const cases = [
      control("combobox:Search Reports:1", "Search Reports", {
        role: "combobox",
        tagName: "input",
        inputType: "search",
      }),
      control("combobox:Filter:1", "Filter", {
        role: "combobox",
        tagName: "select",
      }),
      control("combobox:Status:1", "Status", {
        role: "combobox",
        tagName: "select",
      }),
    ];

    cases.forEach((entry) => {
      const plan = planFor(entry);
      expect(classifyRevealTransition(plan, route).kind).toBe("client-form");
      const representative = representativeInputFor(plan);
      if (plan.action?.operation === "fill")
        expect(representative).toEqual({
          kind: "fill",
          value: "Runtime sweep",
        });
      else expect(representative).toBeUndefined();
    });
  });

  it("rejects a deterministic client form without its frozen action surface", () => {
    const search = control("combobox:Search Reports:1", "Search Reports", {
      role: "combobox",
      tagName: "input",
      inputType: "search",
    });
    const plan = planFor(search);

    expect(() =>
      assertControlTransition(
        preflightControlForPlan(
          plan,
          revealPathFor([], "/lead/report"),
          revealSurfaceFor([plan.control]),
        ),
      ),
    ).toThrow(/has no frozen transition/iu);
  });

  it("keeps cross-route links out of same-route reveal and isolates mutation actions", () => {
    const link = control("link:Archive:1", "Archive", {
      role: "link",
      tagName: "a",
      href: "/archive",
    });
    const mutation = control("button:Mark complete:1", "Mark complete");
    const linkPlan = planFor(link);
    const mutationPlan = planFor(mutation);

    expect(classifyRevealTransition(linkPlan, route).kind).toBe(
      "cross-route-catalog-link",
    );
    expect(classifyRevealTransition(mutationPlan, route).kind).toBe(
      "mutation-required",
    );
  });

  it("keeps lifecycle mutations out of reveal preparation", () => {
    const mutations = [
      control("button:Archive%20period:1", "Archive period"),
      control("button:Unarchive%20period:1", "Unarchive period"),
      control("button:Reopen%20Period:1", "Reopen Period"),
      control("button:Request%20Reopen:1", "Request Reopen"),
    ];
    const disclosure = control("button:Archive:1", "Archive");

    expect(
      mutations.map(
        (entry) => classifyRevealTransition(planFor(entry), route).kind,
      ),
    ).toEqual(mutations.map(() => "mutation-required"));
    expect(classifyRevealTransition(planFor(disclosure), route).kind).toBe(
      "read-only-click",
    );
  });

  it("keeps read-only cancel controls in the reveal candidate set", () => {
    const cancel = control("button:Cancel:1", "Cancel");
    const plan = planFor(cancel);
    expect(classifyRevealTransition(plan, route)).toMatchObject({
      kind: "read-only-click",
      action: { controlKey: cancel.controlKey, transition: "cancel" },
    });
  });

  it("exercises native filters and preserves cross-route links as frozen cells", async () => {
    const search = control("combobox:Search Reports:1", "Search Reports", {
      role: "combobox",
      tagName: "input",
      inputType: "search",
    });
    const filter = control("combobox:Filter:1", "Filter", {
      role: "combobox",
      tagName: "select",
      interactionEffect: "client-only",
    });
    const status = control("combobox:Status:1", "Status", {
      role: "combobox",
      tagName: "select",
      interactionEffect: "client-only",
    });
    const archive = control("link:Archive:1", "Archive", {
      role: "link",
      tagName: "a",
      href: "/archive",
    });
    const initialInventory = inventory([search, filter, status, archive]);
    const initialUrl = "/lead/report?source=redirect&x=2&x=1#hash";
    const liveInitialUrl = absoluteBrowserUrl(initialUrl);
    const recordCall = vi.fn<(value: string) => void>();
    const frozen = { kind: "select" as const, value: "active", index: 1 };
    const harness: RevealExecutionHarness = {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => liveInitialUrl,
      inventory: () => Promise.resolve(initialInventory),
      freezeRepresentativeInput: ({ action }) =>
        Promise.resolve(action.operation === "select" ? frozen : undefined),
      executeReveal: ({ control: target, action, representativeInput }) => {
        recordCall(`${target.accessibleName}:${action.operation}`);
        if (action.operation === "fill")
          expect(representativeInput).toEqual({
            kind: "fill",
            value: "Runtime sweep",
          });
        if (action.operation === "select")
          expect(representativeInput).toEqual(frozen);
        return Promise.resolve({
          url: liveInitialUrl,
          inventory: initialInventory,
          nonMutation: proof,
          ...(representativeInput === undefined ? {} : { representativeInput }),
        });
      },
    };

    const controls = await discoverRevealControls({
      state,
      route,
      initialInventory,
      harness,
      controlFor: preflightControlForPlan,
    });
    const calls = recordCall.mock.calls.map(([value]) => value);
    expect(calls).toEqual(
      expect.arrayContaining([
        "Search Reports:fill",
        "Filter:select",
        "Status:select",
      ]),
    );
    expect(calls).not.toContain("Archive:click");
    const filterCell = controls.find(
      ({ controlKey }) => controlKey === filter.controlKey,
    );
    expect(filterCell?.revealPath.initialUrl).toBe(initialUrl);
    expect(filterCell?.expectedActionTransition?.representativeInput).toEqual({
      kind: "select",
      value: "active",
      index: 1,
    });
    expect(filterCell?.expectedActionTransition?.nonMutation).toEqual(proof);
    const archiveCell = controls.find(
      ({ controlKey }) => controlKey === archive.controlKey,
    );
    expect(archiveCell?.action).toMatchObject({
      operation: "click",
      target: { role: "link", href: "/archive" },
    });
    expect(archiveCell?.expectedActionTransition).toBeNull();
    expect(archiveCell?.revealPath.steps).toHaveLength(0);
  });

  it("rejects exact query-order drift between the executor and live redirect URL", async () => {
    const search = control("combobox:Search Reports:1", "Search Reports", {
      role: "combobox",
      tagName: "input",
      inputType: "search",
    });
    const initialInventory = inventory([search]);
    const liveUrl = absoluteBrowserUrl("/lead/report?x=1&x=2#redirect");
    const harness: RevealExecutionHarness = {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => liveUrl,
      inventory: () => Promise.resolve(initialInventory),
      executeReveal: ({ representativeInput }) =>
        Promise.resolve({
          url: absoluteBrowserUrl("/lead/report?x=2&x=1#redirect"),
          inventory: initialInventory,
          nonMutation: proof,
          ...(representativeInput === undefined ? {} : { representativeInput }),
        }),
    };

    await expect(
      discoverRevealControls({
        state,
        route,
        initialInventory,
        harness,
        controlFor: preflightControlForPlan,
      }),
    ).rejects.toThrow(/disagrees with live current URL/iu);
  });

  it("fails closed when the browser does not provide a current URL", async () => {
    const harness: RevealExecutionHarness = {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      currentUrl: () => "",
      inventory: () => Promise.resolve(inventory([])),
      executeReveal: () => Promise.reject(new Error("not expected")),
    };

    await expect(
      discoverRevealControls({
        state,
        route,
        initialInventory: inventory([]),
        harness,
        controlFor: preflightControlForPlan,
      }),
    ).rejects.toThrow(/current URL/iu);
  });
});
