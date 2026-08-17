import type { ActionNavigationObserver } from "../../replay/control-actions/action-navigation-boundary.ts";
import { settleActionNavigation } from "../../replay/control-actions/action-navigation-boundary.ts";
import type { NavigationPage } from "../../replay/navigation.ts";
import { waitForRevealSurfaceReady } from "../../replay/navigation.ts";
import type { Action } from "../../source/contracts.ts";

export const settleUnchangedRevealAction = async (input: {
  readonly action: Action;
  readonly observer: ActionNavigationObserver;
  readonly page: NavigationPage;
}): Promise<void> => {
  if (
    input.action.operation !== "click" ||
    input.action.safety !== "read-only"
  ) {
    input.observer.cancel();
    return;
  }
  await waitForRevealSurfaceReady(input.page);
  const navigation = await settleActionNavigation(
    input.page,
    input.observer,
    undefined,
    undefined,
  );
  if (navigation.status === "failed")
    throw new Error(`Reveal action navigation failed: ${navigation.reason}`);
  if (navigation.status === "none") input.observer.cancel();
};
