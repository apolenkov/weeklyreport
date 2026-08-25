import {
  type ActionNavigationExpectation,
  type ActionNavigationObserver,
  type ActionNavigationPage,
  expectedActionNavigationFor,
  observeActionNavigation,
  settleActionNavigation,
} from "../../control-actions/action-navigation-boundary.ts";
import type { NavigationPage } from "../../navigation.ts";
import type { ActionOutcome } from "../live/frozen-case-live-actions.ts";

export interface FrozenActionNavigationBoundary {
  readonly expectation: ActionNavigationExpectation | undefined;
  readonly observer: ActionNavigationObserver;
}

type FrozenActionNavigationPage = NavigationPage & ActionNavigationPage;

const targetsCurrentLocation = (
  boundary: FrozenActionNavigationBoundary,
  outcome: ActionOutcome | undefined,
): boolean => {
  const href = outcome?.target?.href;
  if (href === undefined || href === null) return false;
  try {
    return (
      new URL(href, boundary.observer.initialUrl).toString() ===
      new URL(boundary.observer.initialUrl).toString()
    );
  } catch (error: unknown) {
    if (error instanceof TypeError) return false;
    throw error;
  }
};

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
  if (outcome?.status === "not-exercised") {
    boundary.observer.cancel();
    return outcome;
  }
  if (targetsCurrentLocation(boundary, outcome)) {
    boundary.observer.cancel();
    return outcome;
  }
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
