import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import { DEFAULT_MAX_CONTROLS } from "../../../matrix/matrix-limits.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import {
  MAX_REVEAL_ACTIONS,
  MAX_REVEAL_BRANCHES,
  MAX_REVEAL_DEPTH,
} from "../../reveal-path.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "../interaction/preflight-reveal-discovery.ts";

const LANE_COUNT = 100;
const ROUTE = "/lead/report";
const ABSOLUTE_URL = `http://127.0.0.1:3205${ROUTE}`;
const DATABASE_DIGEST = "d".repeat(64);

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "state-00000001",
  pairwiseDigest: "a".repeat(64),
  axes: {
    role: "lead",
    route: `lead:${ROUTE}`,
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

const observation = (
  accessibleName: string,
  order: number,
): DomControlObservation => ({
  controlKey: `button:${accessibleName}:${order}`,
  domOrderKey: `${String(order).padStart(4, "0")}:${accessibleName}`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const inventory = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const lanes = Array.from({ length: LANE_COUNT }, (_, lane) => {
  const suffix = String(lane).padStart(3, "0");
  return {
    root: observation(`Open lane ${suffix}`, lane),
    stageOne: observation(`View lane ${suffix} stage one`, 0),
    stageTwo: observation(`View lane ${suffix} stage two`, 0),
  };
});

const rootInventory = inventory(lanes.map(({ root }) => root));
const emptyInventory = inventory([]);
const nextInventoryByControlKey = new Map(
  lanes.flatMap(({ root, stageOne, stageTwo }) => [
    [root.controlKey, inventory([stageOne])] as const,
    [stageOne.controlKey, inventory([stageTwo])] as const,
    [stageTwo.controlKey, emptyInventory] as const,
  ]),
);

const requiredNextInventory = (controlKey: string): DomInventory => {
  const match = nextInventoryByControlKey.get(controlKey);
  if (match === undefined)
    throw new Error(`Missing reveal fixture transition: ${controlKey}`);
  return match;
};

const harnessFixture = (): Readonly<{
  readonly events: () => readonly string[];
  readonly harness: RevealExecutionHarness;
}> => {
  const recordEvent = vi.fn<(event: string) => void>();
  const events = (): readonly string[] =>
    recordEvent.mock.calls.map(([event]) => event);
  const lastExecutedControlKey = (): string | undefined => {
    const recorded = events();
    const start = recorded.lastIndexOf("prepare");
    return recorded
      .slice(start + 1)
      .filter((event) => event.startsWith("execute:"))
      .at(-1)
      ?.slice("execute:".length);
  };
  const currentInventory = (): DomInventory => {
    const controlKey = lastExecutedControlKey();
    return controlKey === undefined
      ? rootInventory
      : requiredNextInventory(controlKey);
  };
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => {
      recordEvent("navigate");
      return Promise.resolve();
    },
    currentUrl: () => ABSOLUTE_URL,
    inventory: () => {
      recordEvent("inventory");
      return Promise.resolve(currentInventory());
    },
    executeReveal: ({ action }: { readonly action: Action }) => {
      recordEvent(`execute:${action.controlKey}`);
      return Promise.resolve({
        url: ABSOLUTE_URL,
        inventory: currentInventory(),
        nonMutation: {
          status: "unchanged",
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { events, harness };
};

const DEPTH_ROUTE = "/admin";
const DEPTH_ORIGIN = "http://127.0.0.1:3205";
const DEPTH_DATABASE_DIGEST = "f".repeat(64);
const depthState: CampaignMatrixState = {
  ...state,
  stateId: "reveal-depth-chain-state",
  axes: { ...state.axes, role: "admin", route: `admin:${DEPTH_ROUTE}` },
};
const depthControls = [
  observation("Periods", 0),
  observation("Archive", 0),
  observation("Edit period", 0),
  {
    ...observation("Deadline", 0),
    controlKey: "textbox:Deadline:0",
    role: "textbox",
    tagName: "input",
    inputType: "datetime-local",
  },
  observation("Continue details", 0),
].map((control, index) => ({
  ...control,
  controlKey:
    index === 0
      ? "link:Periods:0"
      : index === 1
        ? "button:Archive:0"
        : index === 2
          ? "button:Edit period:0"
          : control.controlKey,
  ...(index === 0
    ? { role: "link", tagName: "a", href: "/admin?tab=periods" }
    : {}),
}));
const depthPathFor = (stage: number): string =>
  `${DEPTH_ROUTE}?tab=${["root", "periods", "archive", "edit", "deadline", "details"][stage] ?? "root"}`;
const depthInventoryFor = (
  stage: number,
  includeFifth: boolean,
): DomInventory =>
  inventory(
    stage < 5 && (stage < 4 || includeFifth)
      ? [depthControls[stage] as DomControlObservation]
      : [],
  );
const depthFixture = (includeFifth: boolean) => {
  const recordEvent = vi.fn<(event: string) => void>();
  const events = (): readonly string[] =>
    recordEvent.mock.calls.map(([event]) => event);
  const stage = (): number =>
    Math.min(
      events()
        .slice(events().lastIndexOf("prepare") + 1)
        .filter((event) => event.startsWith("execute:")).length,
      5,
    );
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => {
      recordEvent("navigate");
      return Promise.resolve();
    },
    currentUrl: () => `${DEPTH_ORIGIN}${depthPathFor(stage())}`,
    inventory: () => Promise.resolve(depthInventoryFor(stage(), includeFifth)),
    executeReveal: ({ action, representativeInput }) => {
      const nextStage = stage() + 1;
      recordEvent(`execute:${action.controlKey}`);
      return Promise.resolve({
        url: `${DEPTH_ORIGIN}${depthPathFor(nextStage)}`,
        inventory: depthInventoryFor(nextStage, includeFifth),
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DEPTH_DATABASE_DIGEST,
          afterDigest: DEPTH_DATABASE_DIGEST,
        },
        ...(representativeInput === undefined ? {} : { representativeInput }),
      });
    },
  };
  return { events, harness };
};

describe("reveal discovery budgets", () => {
  it("shares matrix capacity and allows more than 256 semantic branches", async () => {
    const fixture = harnessFixture();
    const controls = await discoverRevealControls({
      state,
      route: { resolvedRoute: ROUTE },
      initialInventory: rootInventory,
      harness: fixture.harness,
      controlFor: preflightControlForPlan,
    });
    const executions = fixture
      .events()
      .filter((event) => event.startsWith("execute:"));

    expect(MAX_REVEAL_BRANCHES).toBe(DEFAULT_MAX_CONTROLS);
    expect(MAX_REVEAL_BRANCHES).toBe(1024);
    expect(MAX_REVEAL_ACTIONS).toBe(
      MAX_REVEAL_BRANCHES * (MAX_REVEAL_DEPTH + 1),
    );
    expect(MAX_REVEAL_ACTIONS).toBe(5120);
    expect(controls).toHaveLength(LANE_COUNT * 3);
    expect(executions).toHaveLength(LANE_COUNT * 6);
    expect(controls.length).toBeGreaterThan(256);
    expect(executions.length).toBeGreaterThan(256);
  });

  it("covers four non-mutating transitions and rejects a fifth at the default bound", async () => {
    expect(MAX_REVEAL_DEPTH).toBe(4);
    const discover = async (includeFifth: boolean) => {
      const fixture = depthFixture(includeFifth);
      const controls = await discoverRevealControls({
        state: depthState,
        route: { resolvedRoute: DEPTH_ROUTE },
        initialInventory: depthInventoryFor(0, includeFifth),
        harness: fixture.harness,
        controlFor: preflightControlForPlan,
      });
      return { controls, events: fixture.events() };
    };
    const result = await discover(false);
    const deadline = result.controls.find(
      ({ controlKey }) => controlKey === "textbox:Deadline:0",
    );
    expect(
      result.events.filter((event) => event.startsWith("execute:")).slice(-4),
    ).toEqual([
      "execute:link:Periods:0",
      "execute:button:Archive:0",
      "execute:button:Edit period:0",
      "execute:textbox:Deadline:0",
    ]);
    expect(deadline?.revealPath.steps).toHaveLength(3);
    expect(deadline?.expectedActionTransition?.representativeInput).toEqual({
      kind: "fill",
      value: "2026-01-01T12:00",
    });
    await expect(discover(true)).rejects.toThrow(/depth bound/iu);
  });
});
