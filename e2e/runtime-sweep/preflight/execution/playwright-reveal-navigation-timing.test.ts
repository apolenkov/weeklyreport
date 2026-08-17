import { describe, expect, it } from "vitest";

import { observeActionNavigation } from "../../replay/control-actions/action-navigation-boundary.ts";
import type { Action } from "../../source/contracts.ts";
import { createCapacitySurveyTiming } from "../capacity/preflight-capacity-survey-timing.ts";
import { settleUnchangedRevealAction } from "./playwright-reveal-navigation.ts";

const SOURCE_URL = "https://runtime.invalid/admin";

const action: Action = {
  controlKey: "button:Open%20section:1",
  operation: "click",
  safety: "read-only",
  transition: "open",
};

const runSettledAction = async (enabled: boolean) => {
  let nowMs = 0;
  const events: string[] = [];
  const timing = createCapacitySurveyTiming({
    enabled,
    now: () => nowMs,
  });
  const page = {
    goto: () => Promise.resolve(null),
    url: () => SOURCE_URL,
    waitForFunction: () => {
      events.push("waitForFunction");
      nowMs += 2;
      return Promise.resolve();
    },
    waitForLoadState: () => {
      events.push("waitForLoadState");
      return Promise.resolve();
    },
    waitForURL: () => {
      events.push("waitForURL");
      nowMs += 3;
      const error = new Error("bounded navigation grace elapsed");
      error.name = "TimeoutError";
      return Promise.reject(error);
    },
  };
  const observed = observeActionNavigation(page);
  const observer = {
    ...observed,
    cancel: () => {
      events.push("cancel");
      observed.cancel();
    },
  };

  await timing.span("action", () =>
    settleUnchangedRevealAction({ action, observer, page, timing }),
  );
  return { events, snapshot: timing.snapshot() };
};

describe("reveal navigation timing parity", () => {
  it("preserves wait and cancellation behavior when timing is enabled", async () => {
    const disabled = await runSettledAction(false);
    const enabled = await runSettledAction(true);

    expect(enabled.events).toEqual(disabled.events);
    expect(enabled.events).toEqual([
      "waitForFunction",
      "waitForFunction",
      "waitForURL",
      "cancel",
    ]);
    expect(enabled.snapshot).toMatchObject({
      actionRevealReadyCount: 1,
      actionNavigationBoundaryCount: 1,
      navigationNoneCount: 1,
      navigationObservedCount: 0,
    });
    expect(enabled.snapshot.actionRevealReadyCount).toBe(
      enabled.snapshot.actionNavigationBoundaryCount,
    );
    expect(enabled.snapshot.actionRevealReadyCount).toBe(
      enabled.snapshot.navigationNoneCount +
        enabled.snapshot.navigationObservedCount,
    );
    expect(enabled.snapshot.actionRevealReadyWallMs).toBeLessThanOrEqual(
      enabled.snapshot.actionWallMs,
    );
    expect(enabled.snapshot.actionNavigationBoundaryWallMs).toBeLessThanOrEqual(
      enabled.snapshot.actionWallMs,
    );
    expect(disabled.snapshot.actionRevealReadyCount).toBe(0);
    expect(disabled.snapshot.actionNavigationBoundaryCount).toBe(0);
  });
});
