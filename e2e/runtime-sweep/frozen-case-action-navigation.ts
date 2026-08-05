import {
  type ActionNavigationExpectation,
  type ActionNavigationObserver,
  type ActionNavigationPage,
  expectedActionNavigationFor,
  observeActionNavigation,
  settleActionNavigation,
} from "./action-navigation-boundary.ts";
import type { ActionOutcome } from "./frozen-case-live-actions.ts";
import type { NavigationPage } from "./navigation.ts";

export interface FrozenActionNavigationBoundary {
  readonly expectation: ActionNavigationExpectation | undefined;
  readonly observer: ActionNavigationObserver;
}

type FrozenActionNavigationPage = NavigationPage & ActionNavigationPage;

export const beginFrozenActionNavigation = (
  page: ActionNavigationPage,
  controlKey: string,
): FrozenActionNavigationBoundary => {
  const expectation = expectedActionNavigationFor(controlKey);
  return {
    expectation,
    observer: observeActionNavigation(page, expectation),
  };
};

export const settleFrozenActionNavigation = async (
  page: FrozenActionNavigationPage,
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
    observation: {
      kind: "url",
      detail: "Main-frame navigation observed after the action",
    },
    controlKey: outcome.controlKey,
    ...(outcome.target === undefined ? {} : { target: outcome.target }),
    ...(outcome.surfaceObservation === undefined
      ? {}
      : { surfaceObservation: outcome.surfaceObservation }),
  };
};
