import { describe, expect, it, vi } from "vitest";

import type { ActionNavigationObserver } from "../../replay/control-actions/action-navigation-boundary.ts";
import type { DomInventory } from "../../replay/dom/dom-inventory.ts";
import type { Action } from "../../source/contracts.ts";
import { createCapacitySurveyTiming } from "../capacity/preflight-capacity-survey-timing.ts";
import { settleUnchangedRevealAction } from "./playwright-reveal-navigation.ts";
import {
  captureRevealExecutionObservation,
  type RevealExecutionObservationPage,
} from "./playwright-reveal-observation.ts";

const sourceUrl =
  "https://runtime.invalid/lead/report/a0000000-0000-4000-8000-000000000001";
const destinationUrl =
  "https://runtime.invalid/lead/report/a0000000-0000-4000-8000-000000000002";
const secondDestinationUrl =
  "https://runtime.invalid/lead/report/a0000000-0000-4000-8000-000000000003";
const sourceInventory: DomInventory = {
  controls: [],
  issues: [],
  visibleText: "Source report",
};
const destinationInventory: DomInventory = {
  controls: [],
  issues: [],
  visibleText: "Destination report",
};
const action: Action = {
  controlKey: "listbox:Reporting%20period:1",
  operation: "click",
  safety: "read-only",
  transition: "none",
};

describe("Playwright reveal URL and inventory coherence", () => {
  it("cancels navigation observation for actions outside read-only clicks", async () => {
    const observer: ActionNavigationObserver = {
      cancel: vi.fn(),
      initialUrl: sourceUrl,
      waitForNavigation: vi.fn(() => Promise.resolve(false)),
    };
    const page = {
      goto: () => Promise.resolve(null),
      url: () => sourceUrl,
      waitForFunction: () => Promise.resolve(),
      waitForLoadState: () => Promise.resolve(),
      waitForURL: () => Promise.resolve(),
    };

    await settleUnchangedRevealAction({
      action: { ...action, safety: "irreversible" },
      observer,
      page,
    });

    expect(observer.cancel).toHaveBeenCalledOnce();
    expect(observer.waitForNavigation).not.toHaveBeenCalled();
  });

  it("recaptures inventory when navigation commits during the first capture", async () => {
    const state = { inventoryCalls: 0, url: sourceUrl };
    const waitForLoadState = vi.fn(() => Promise.resolve());
    const page = {
      url: () => state.url,
      waitForFunction: () => Promise.resolve(),
      waitForLoadState,
    } satisfies RevealExecutionObservationPage;
    const inventory = vi.fn(() => {
      state.inventoryCalls += 1;
      if (state.inventoryCalls === 1) {
        state.url = destinationUrl;
        return Promise.resolve(sourceInventory);
      }
      return Promise.resolve(destinationInventory);
    });

    const result = await captureRevealExecutionObservation({ inventory, page });

    expect(result).toEqual({
      inventory: destinationInventory,
      url: destinationUrl,
    });
    expect(inventory).toHaveBeenCalledTimes(2);
    expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
      timeout: 3000,
    });
  });

  it("fails closed when URL changes again during the settled capture", async () => {
    const state = { inventoryCalls: 0, url: sourceUrl };
    const page = {
      url: () => state.url,
      waitForFunction: () => Promise.resolve(),
      waitForLoadState: () => Promise.resolve(),
    } satisfies RevealExecutionObservationPage;
    const inventory = vi.fn(() => {
      state.inventoryCalls += 1;
      state.url =
        state.inventoryCalls === 1 ? destinationUrl : secondDestinationUrl;
      return Promise.resolve(destinationInventory);
    });

    await expect(
      captureRevealExecutionObservation({ inventory, page }),
    ).rejects.toThrow("Reveal URL changed during settled inventory capture");
    expect(inventory).toHaveBeenCalledTimes(2);
  });

  it("settles navigation that commits during reveal readiness", async () => {
    const state = { url: sourceUrl };
    const waitForLoadState = vi.fn(() => Promise.resolve());
    const page = {
      goto: () => Promise.resolve(null),
      url: () => state.url,
      waitForFunction: vi.fn(() => {
        state.url = destinationUrl;
        return Promise.resolve();
      }),
      waitForLoadState,
      waitForURL: () => Promise.resolve(),
    };
    const observer: ActionNavigationObserver = {
      cancel: vi.fn(),
      initialUrl: sourceUrl,
      waitForNavigation: vi.fn(() => Promise.resolve(true)),
    };

    await settleUnchangedRevealAction({ action, observer, page });

    expect(page.url()).toBe(destinationUrl);
    expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
      timeout: 3000,
    });
    expect(observer.waitForNavigation).toHaveBeenCalledOnce();
  });

  it("waits for bounded navigation grace after reveal readiness", async () => {
    const state = { url: sourceUrl };
    const waitForLoadState = vi.fn(() => Promise.resolve());
    const page = {
      goto: () => Promise.resolve(null),
      url: () => state.url,
      waitForFunction: () => Promise.resolve(),
      waitForLoadState,
      waitForURL: () => Promise.resolve(),
    };
    const observer: ActionNavigationObserver = {
      cancel: vi.fn(),
      initialUrl: sourceUrl,
      waitForNavigation: vi.fn(() => {
        state.url = destinationUrl;
        return Promise.resolve(true);
      }),
    };

    await settleUnchangedRevealAction({ action, observer, page });

    expect(page.url()).toBe(destinationUrl);
    expect(observer.waitForNavigation).toHaveBeenCalledOnce();
    expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
      timeout: 3000,
    });
  });

  it("records nested reveal readiness and observed navigation spans", async () => {
    let nowMs = 0;
    const timing = createCapacitySurveyTiming({
      enabled: true,
      now: () => nowMs,
    });
    const state = { url: sourceUrl };
    const page = {
      goto: () => Promise.resolve(null),
      url: () => state.url,
      waitForFunction: vi.fn(() => {
        nowMs += 2;
        return Promise.resolve();
      }),
      waitForLoadState: vi.fn(() => Promise.resolve()),
      waitForURL: () => Promise.resolve(),
    };
    const observer: ActionNavigationObserver = {
      cancel: vi.fn(),
      initialUrl: sourceUrl,
      waitForNavigation: vi.fn(() => {
        nowMs += 3;
        state.url = destinationUrl;
        return Promise.resolve(true);
      }),
    };

    await timing.span("action", () =>
      settleUnchangedRevealAction({ action, observer, page, timing }),
    );

    const snapshot = timing.snapshot();
    expect(snapshot.actionRevealReadyCount).toBe(1);
    expect(snapshot.actionNavigationBoundaryCount).toBe(1);
    expect(snapshot.navigationNoneCount).toBe(0);
    expect(snapshot.navigationObservedCount).toBe(1);
    expect(snapshot.actionRevealReadyWallMs).toBeLessThanOrEqual(
      snapshot.actionWallMs,
    );
    expect(snapshot.actionNavigationBoundaryWallMs).toBeLessThanOrEqual(
      snapshot.actionWallMs,
    );
    expect(observer.cancel).not.toHaveBeenCalled();
  });

  it("retains readiness and navigation exception identity", async () => {
    const readinessError = new Error("readiness sentinel");
    const timing = createCapacitySurveyTiming({ enabled: true, now: () => 0 });
    const observer: ActionNavigationObserver = {
      cancel: vi.fn(),
      initialUrl: sourceUrl,
      waitForNavigation: vi.fn(() => Promise.resolve(false)),
    };
    const page = {
      goto: () => Promise.resolve(null),
      url: () => sourceUrl,
      waitForFunction: () => Promise.reject(readinessError),
      waitForLoadState: () => Promise.resolve(),
      waitForURL: () => Promise.resolve(),
    };

    await expect(
      settleUnchangedRevealAction({ action, observer, page, timing }),
    ).rejects.toBe(readinessError);

    const navigationError = new Error("navigation sentinel");
    const navigationObserver: ActionNavigationObserver = {
      cancel: vi.fn(),
      initialUrl: sourceUrl,
      waitForNavigation: vi.fn(() => Promise.reject(navigationError)),
    };
    const readyPage = {
      goto: () => Promise.resolve(null),
      url: () => sourceUrl,
      waitForFunction: () => Promise.resolve(),
      waitForLoadState: () => Promise.resolve(),
      waitForURL: () => Promise.resolve(),
    };

    await expect(
      settleUnchangedRevealAction({
        action,
        observer: navigationObserver,
        page: readyPage,
        timing,
      }),
    ).rejects.toBe(navigationError);
  });
});
