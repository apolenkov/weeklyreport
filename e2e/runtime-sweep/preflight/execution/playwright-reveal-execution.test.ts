import type { Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DomControlObservation,
  DomInventory,
} from "../../replay/dom/dom-inventory.ts";
import type { Action } from "../../source/contracts.ts";
import type { RevealNonMutationProof } from "../reveal-path.ts";

const harness = vi.hoisted(() => {
  const state = {
    changedUrl: undefined as string | undefined,
    events: [] as string[],
    pageUrl: "https://runtime.invalid/reports",
  };
  const inventory: DomInventory = { controls: [], issues: [] };
  return {
    inventory,
    inventoryDom: vi.fn(() => {
      state.events.push("inventory");
      return inventory;
    }),
    snapshotPage: vi.fn(() => ({
      controls: [],
      dom: "",
      focus: "",
      network: 0,
      url: state.pageUrl,
    })),
    state,
    executeControlAction: vi.fn(() => {
      state.events.push("action");
      if (state.changedUrl !== undefined) state.pageUrl = state.changedUrl;
      return {
        controlKey: "link:Home:1",
        operation: "click" as const,
        resetPerformed: false,
        status: "pass" as const,
      };
    }),
  };
});

vi.mock("../../replay/control-actions/control-actions.ts", () => ({
  executeControlAction: harness.executeControlAction,
}));

vi.mock("../../replay/dom/dom-inventory.ts", () => ({
  inventoryDom: harness.inventoryDom,
}));

vi.mock("../../replay/live-control/live-control-observation.ts", () => ({
  snapshotPage: harness.snapshotPage,
}));

vi.mock("../../replay/live-control/live-control-records.ts", () => ({
  observerFor: vi.fn(() => () => "pass" as const),
  targetFor: vi.fn((control: unknown) => control),
}));

import { createPlaywrightRevealExecutor } from "./playwright-reveal-execution.ts";

const control: DomControlObservation = {
  accessibleName: "Home",
  controlKey: "link:Home:1",
  disabled: false,
  domOrderKey: "0001:link:Home:1",
  enabled: true,
  href: "/admin",
  inputType: null,
  order: 1,
  role: "link",
  tagName: "a",
  visible: true,
};

const action: Action = {
  controlKey: control.controlKey,
  operation: "click",
  safety: "read-only",
  transition: "open",
};

const proof: RevealNonMutationProof = {
  afterDigest: "a".repeat(64),
  beforeDigest: "a".repeat(64),
  status: "unchanged",
};

const pageFor = (): {
  readonly page: Page;
  readonly waitForFunction: ReturnType<typeof vi.fn>;
  readonly waitForLoadState: ReturnType<typeof vi.fn>;
} => {
  const waitForLoadState = vi.fn(() => {
    harness.state.events.push("load-state");
  });
  const waitForFunction = vi.fn(() => {
    harness.state.events.push("app-ready");
  });
  return {
    page: {
      url: () => harness.state.pageUrl,
      waitForFunction,
      waitForLoadState,
    } as unknown as Page,
    waitForFunction,
    waitForLoadState,
  };
};

const runReveal = async (
  changedUrl?: string,
): Promise<{
  readonly result: Awaited<
    ReturnType<ReturnType<typeof createPlaywrightRevealExecutor>>
  >;
  readonly waitForFunction: ReturnType<typeof vi.fn>;
  readonly waitForLoadState: ReturnType<typeof vi.fn>;
}> => {
  harness.state.changedUrl = changedUrl;
  harness.state.pageUrl = "https://runtime.invalid/reports";
  const page = pageFor();
  const executeReveal = createPlaywrightRevealExecutor({ page: page.page });
  const preparation = {
    proveNonMutation: async (
      revealAction: () => Promise<void>,
    ): Promise<RevealNonMutationProof> => {
      await revealAction();
      return proof;
    },
  };
  const result = await executeReveal({
    action,
    control,
    preparation,
  });
  return {
    result,
    waitForFunction: page.waitForFunction,
    waitForLoadState: page.waitForLoadState,
  };
};

describe("Playwright reveal execution", () => {
  beforeEach(() => {
    harness.state.changedUrl = undefined;
    harness.state.events.length = 0;
    harness.state.pageUrl = "https://runtime.invalid/reports";
    harness.executeControlAction.mockClear();
    harness.inventoryDom.mockClear();
    harness.snapshotPage.mockClear();
  });

  it("settles a changed URL before freezing the reveal inventory", async () => {
    const changedUrl = "https://runtime.invalid/admin";
    const { result, waitForFunction, waitForLoadState } =
      await runReveal(changedUrl);

    expect(result.url).toBe(changedUrl);
    expect(waitForLoadState).toHaveBeenCalledOnce();
    expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
      timeout: 3000,
    });
    expect(waitForFunction).toHaveBeenCalledTimes(2);
    expect(harness.state.events).toEqual([
      "action",
      "load-state",
      "app-ready",
      "app-ready",
      "inventory",
    ]);
  });

  it("does not settle an unchanged URL before freezing the reveal inventory", async () => {
    const { result, waitForFunction, waitForLoadState } = await runReveal();

    expect(result.url).toBe("https://runtime.invalid/reports");
    expect(waitForLoadState).not.toHaveBeenCalled();
    expect(waitForFunction).not.toHaveBeenCalled();
    expect(harness.state.events).toEqual(["action", "inventory"]);
  });
});
