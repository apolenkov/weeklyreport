import type { Page } from "@playwright/test";

import {
  type ActionNavigationExpectation,
  type ActionNavigationObserver,
  expectedActionNavigationFor,
  observeActionNavigation,
  settleActionNavigation,
} from "./action-navigation-boundary.ts";
import type { ActionOutcome } from "./frozen-case-live-actions.ts";

export interface FrozenActionNavigationBoundary {
  readonly expectation: ActionNavigationExpectation | undefined;
  readonly observer: ActionNavigationObserver;
}

export const beginFrozenActionNavigation = (
  page: Page,
  controlKey: string,
): FrozenActionNavigationBoundary => {
  const expectation = expectedActionNavigationFor(controlKey);
  return {
    expectation,
    observer: observeActionNavigation(page, expectation),
  };
};

export const settleFrozenActionNavigation = async (
  page: Page,
  boundary: FrozenActionNavigationBoundary,
  outcome: ActionOutcome | undefined,
): Promise<ActionOutcome | undefined> => {
  const navigation = await settleActionNavigation(
    page,
    boundary.observer,
    outcome,
    boundary.expectation,
  );
  if (navigation.status === "failed" && outcome !== undefined) {
    return { ...outcome, status: "fail", reason: navigation.reason };
  }
  if (navigation.status !== "observed" || outcome?.status !== "fail") {
    return outcome;
  }
  return {
    status: "pass",
    controlKey: outcome.controlKey,
    observation: {
      kind: "url",
      detail: "Main-frame navigation observed after the action",
    },
  };
};
