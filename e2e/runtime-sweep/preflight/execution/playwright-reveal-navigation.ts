import {
  type ActionNavigationExpectation,
  type ActionNavigationObserver,
  settleActionNavigation,
} from "../../replay/control-actions/action-navigation-boundary.ts";
import type { LiveControlObservation } from "../../replay/live-control/live-control-planning.ts";
import {
  type NavigationPage,
  waitForAppReady,
  waitForRevealSurfaceReady,
} from "../../replay/navigation.ts";
import type { Action } from "../../source/contracts.ts";
import type { RevealExecutionTiming } from "../reveal/interaction/preflight-reveal-types.ts";

export const settleUnchangedRevealAction = async (input: {
  readonly action: Action;
  readonly observer: ActionNavigationObserver;
  readonly outcome?: Readonly<{
    readonly observation?: LiveControlObservation;
  }>;
  readonly page: NavigationPage;
  readonly timing?: RevealExecutionTiming | undefined;
}): Promise<void> => {
  const timed = <Value>(
    stage: Parameters<RevealExecutionTiming["span"]>[0],
    operation: () => Promise<Value>,
  ): Promise<Value> => input.timing?.span(stage, operation) ?? operation();
  if (
    input.action.operation !== "click" ||
    input.action.safety !== "read-only"
  ) {
    input.observer.cancel();
    return;
  }
  await timed("actionRevealReady", () => waitForRevealSurfaceReady(input.page));
  const stableDomOutcome =
    input.outcome?.observation?.kind === "dom" &&
    input.page.url() === input.observer.initialUrl
      ? input.outcome
      : undefined;
  const navigation = await timed("actionNavigationBoundary", () =>
    settleActionNavigation(
      input.page,
      input.observer,
      stableDomOutcome,
      undefined,
    ),
  );
  if (navigation.status === "failed")
    throw new Error(`Reveal action navigation failed: ${navigation.reason}`);
  if (navigation.status === "none") {
    if (stableDomOutcome === undefined) input.observer.cancel();
    await timed("navigationNone", () => Promise.resolve());
    return;
  }
  await timed("navigationObserved", () => Promise.resolve());
};

type RevealActionNavigationInput = Readonly<{
  action: Action;
  currentLocation: boolean;
  expectedNavigation: ActionNavigationExpectation | undefined;
  observation: LiveControlObservation | undefined;
  observer: ActionNavigationObserver;
  page: NavigationPage;
  timing?: RevealExecutionTiming | undefined;
}>;

export const settleRevealActionNavigation = async (
  input: RevealActionNavigationInput,
): Promise<void> => {
  if (input.currentLocation) {
    input.observer.cancel();
    return waitForAppReady(input.page);
  }
  if (
    input.expectedNavigation !== undefined ||
    input.page.url() !== input.observer.initialUrl
  ) {
    const navigation = await settleActionNavigation(
      input.page,
      input.observer,
      undefined,
      input.expectedNavigation,
    );
    if (navigation.status === "failed")
      throw new Error(`Reveal action navigation failed: ${navigation.reason}`);
    return;
  }
  await settleUnchangedRevealAction({
    action: input.action,
    observer: input.observer,
    outcome:
      input.observation === undefined ? {} : { observation: input.observation },
    page: input.page,
    timing: input.timing,
  });
};
