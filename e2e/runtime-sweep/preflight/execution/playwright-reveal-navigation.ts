import type { ActionNavigationObserver } from "../../replay/control-actions/action-navigation-boundary.ts";
import { settleActionNavigation } from "../../replay/control-actions/action-navigation-boundary.ts";
import type { NavigationPage } from "../../replay/navigation.ts";
import { waitForRevealSurfaceReady } from "../../replay/navigation.ts";
import type { Action } from "../../source/contracts.ts";
import type { RevealExecutionTiming } from "../reveal/interaction/preflight-reveal-types.ts";

export const settleUnchangedRevealAction = async (input: {
  readonly action: Action;
  readonly observer: ActionNavigationObserver;
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
  const navigation = await timed("actionNavigationBoundary", () =>
    settleActionNavigation(input.page, input.observer, undefined, undefined),
  );
  if (navigation.status === "failed")
    throw new Error(`Reveal action navigation failed: ${navigation.reason}`);
  if (navigation.status === "none") {
    input.observer.cancel();
    await timed("navigationNone", () => Promise.resolve());
    return;
  }
  await timed("navigationObserved", () => Promise.resolve());
};
