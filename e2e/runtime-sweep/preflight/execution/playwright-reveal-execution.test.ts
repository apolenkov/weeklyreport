import type { Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DomControlObservation,
  DomInventory,
} from "../../replay/dom/dom-inventory.ts";
import type { Action } from "../../source/contracts.ts";
import type { RevealNonMutationProof } from "../reveal-path.ts";

const harness = vi.hoisted(() => {
  const state = {
    changedUrl: undefined as string | undefined,
    delayedUrl: undefined as string | undefined,
    events: [] as string[],
    loadingAfterAction: false,
    loading: false,
    pageUrl: "https://runtime.invalid/reports",
    overlayHiddenMain: false,
  };
  const inventory: DomInventory = { controls: [], issues: [] };
  return {
    inventory,
    inventoryDom: vi.fn(() => {
      if (state.loading) throw new Error("inventory observed loading DOM");
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
      if (state.loadingAfterAction) {
        state.loading = true;
        state.events.push("loading");
      }
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
const buttonControl: DomControlObservation = {
  ...control,
  accessibleName: "More actions",
  controlKey: "button:More%20actions:1",
  href: null,
  role: "button",
  tagName: "button",
};
const buttonAction: Action = {
  ...action,
  controlKey: buttonControl.controlKey,
};

const proof: RevealNonMutationProof = {
  afterDigest: "a".repeat(64),
  beforeDigest: "a".repeat(64),
  status: "unchanged",
};

const pageFor = () => {
  const waitForLoadState = vi.fn(() => {
    harness.state.events.push("load-state");
  });
  const waitForFunction = vi.fn(
    (predicate: (argument: unknown) => boolean, argument?: unknown) => {
      harness.state.events.push("app-ready");
      harness.state.loading = false;
      if (harness.state.overlayHiddenMain && !predicate(argument)) {
        const error = new Error("readiness timed out");
        error.name = "TimeoutError";
        return Promise.reject(error);
      }
      return Promise.resolve();
    },
  );
  const waitForURL = vi.fn((predicate: (url: URL) => boolean) => {
    harness.state.events.push("wait-url");
    if (harness.state.delayedUrl === undefined) {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      return Promise.reject(error);
    }
    harness.state.pageUrl = harness.state.delayedUrl;
    if (!predicate(new URL(harness.state.pageUrl)))
      return Promise.reject(new Error("Navigation predicate rejected URL"));
    return Promise.resolve();
  });
  return {
    page: Object.assign({} as Page, {
      url: () => harness.state.pageUrl,
      waitForFunction,
      waitForLoadState,
      waitForURL,
    }),
    waitForFunction,
    waitForLoadState,
    waitForURL,
  };
};

const runReveal = async (input?: {
  readonly action?: Action;
  readonly changedUrl?: string;
  readonly control?: DomControlObservation;
  readonly delayedUrl?: string;
  readonly loadingAfterAction?: boolean;
  readonly overlayHiddenMain?: boolean;
}) => {
  harness.state.changedUrl = input?.changedUrl;
  harness.state.delayedUrl = input?.delayedUrl;
  harness.state.loadingAfterAction = input?.loadingAfterAction ?? false;
  harness.state.overlayHiddenMain = input?.overlayHiddenMain ?? false;
  harness.state.loading = false;
  harness.state.pageUrl = "https://runtime.invalid/reports";
  if (harness.state.overlayHiddenMain) {
    const menu = {
      ariaHidden: null,
      closest: () => null,
      getAttribute: () => null,
      getClientRects: () => [{}],
      matches: () => false,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    const main = {
      ...menu,
      ariaHidden: "true",
      contains: () => false,
      getAttribute: (name: string) => (name === "aria-busy" ? "false" : "true"),
      querySelector: (selector: string) => (selector === "h1" ? menu : null),
    };
    vi.stubGlobal("HTMLElement", Object);
    vi.stubGlobal("document", {
      getAnimations: () => [],
      querySelector: () => main,
      querySelectorAll: () => [menu],
    });
  }
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
    action: input?.action ?? action,
    control: input?.control ?? control,
    preparation,
  });
  return {
    result,
    waitForFunction: page.waitForFunction,
    waitForLoadState: page.waitForLoadState,
    waitForURL: page.waitForURL,
  };
};

describe("Playwright reveal execution", () => {
  beforeEach(() => {
    harness.state.changedUrl = undefined;
    harness.state.delayedUrl = undefined;
    harness.state.events.length = 0;
    harness.state.loadingAfterAction = false;
    harness.state.loading = false;
    harness.state.pageUrl = "https://runtime.invalid/reports";
    harness.executeControlAction.mockClear();
    harness.inventoryDom.mockClear();
    harness.snapshotPage.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("settles a changed URL before freezing the reveal inventory", async () => {
    const changedUrl = "https://runtime.invalid/admin";
    const { result, waitForFunction, waitForLoadState } = await runReveal({
      changedUrl,
    });

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

  it("observes delayed client navigation before freezing the reveal inventory", async () => {
    const delayedUrl = "https://runtime.invalid/admin";
    const { result, waitForURL } = await runReveal({ delayedUrl });

    expect(result.url).toBe(delayedUrl);
    expect(waitForURL).toHaveBeenCalledOnce();
    expect(harness.state.events).toEqual([
      "action",
      "wait-url",
      "load-state",
      "app-ready",
      "app-ready",
      "inventory",
    ]);
  });

  it("keeps an exact current-location link idempotent", async () => {
    const currentControl = { ...control, href: "/reports" };
    const { result, waitForFunction, waitForLoadState, waitForURL } =
      await runReveal({ control: currentControl });

    expect(result.url).toBe("https://runtime.invalid/reports");
    expect(waitForURL).not.toHaveBeenCalled();
    expect(waitForLoadState).not.toHaveBeenCalled();
    expect(waitForFunction).toHaveBeenCalledTimes(2);
    expect(harness.state.events).toEqual([
      "action",
      "app-ready",
      "app-ready",
      "inventory",
    ]);
  });

  it("fails closed when an expected link navigation never starts", async () => {
    await expect(runReveal()).rejects.toThrow(
      "Reveal action navigation failed: Navigation was not observed within the bounded wait",
    );
    expect(harness.inventoryDom).not.toHaveBeenCalled();
    expect(harness.state.events).toEqual(["action", "wait-url"]);
  });

  it("settles loading after an unchanged read-only click before inventory", async () => {
    const { waitForFunction, waitForURL } = await runReveal({
      action: buttonAction,
      control: buttonControl,
      loadingAfterAction: true,
    });

    expect(waitForURL).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 100,
    });
    expect(waitForFunction).toHaveBeenCalledTimes(2);
    expect(harness.state.events).toEqual(
      "action loading app-ready app-ready wait-url inventory".split(" "),
    );
  });

  it("uses overlay readiness only for an unchanged read-only button", async () => {
    await expect(
      runReveal({
        action: buttonAction,
        control: buttonControl,
        overlayHiddenMain: true,
      }),
    ).resolves.toBeDefined();

    await expect(
      runReveal({
        control: { ...control, href: "/reports" },
        overlayHiddenMain: true,
      }),
    ).rejects.toThrow("readiness timed out");
  });
});
