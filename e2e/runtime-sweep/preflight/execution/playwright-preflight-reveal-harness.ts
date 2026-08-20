import { assertInitialLanding } from "../reveal/guards/preflight-reveal-guards.ts";
import type { RevealExecutionHarness } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  BrowserPreflightError,
  type BrowserPreflightHarness,
  type PreflightRoute,
  revealRouteFor,
} from "./playwright-preflight-support.ts";

export type RevealNavigationHarness = BrowserPreflightHarness & {
  readonly navigateReveal?: BrowserPreflightHarness["navigate"];
};

export const revealHarnessFor = (
  harness: BrowserPreflightHarness,
): RevealExecutionHarness => ({
  prepare: (state, revealRoute) =>
    harness.prepare(state, revealRoute as PreflightRoute, false),
  navigate:
    (harness as RevealNavigationHarness).navigateReveal ?? harness.navigate,
  currentUrl: () => {
    if (typeof harness.currentUrl !== "function")
      throw new BrowserPreflightError(
        "Browser preflight current URL callback is not configured",
      );
    return harness.currentUrl();
  },
  inventory: harness.inventory,
  ...(harness.freezeRepresentativeInput === undefined
    ? {}
    : { freezeRepresentativeInput: harness.freezeRepresentativeInput }),
  executeReveal:
    harness.executeReveal ??
    (() =>
      Promise.reject(
        new BrowserPreflightError(
          "Preflight reveal execution is not configured",
        ),
      )),
});

export const navigateToRevealLanding = async (
  harness: BrowserPreflightHarness,
  route: PreflightRoute,
): Promise<ReturnType<typeof revealRouteFor>> => {
  const revealRoute = revealRouteFor(route);
  await revealHarnessFor(harness).navigate(revealRoute.resolvedRoute);
  assertInitialLanding(
    revealRoute,
    harness.currentUrl(),
    harness.expectedOrigin,
  );
  return revealRoute;
};
