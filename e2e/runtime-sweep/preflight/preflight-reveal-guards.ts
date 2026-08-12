import type { DomInventory } from "../replay/dom-inventory.ts";
import type { ResolverOutcomeKind } from "../source/contracts.ts";
import { stableSerialize } from "../support/ids.ts";
import {
  resolverExpectedUiFor,
  type ResolverOutcomeExpectation,
} from "../support/resolver-outcome-expectations.ts";
import {
  RevealDiscoveryError,
  type RevealExecution,
  type RevealRoute,
} from "./preflight-reveal-types.ts";
import {
  canonicalRevealUrlFor,
  revealNonMutationProofSchema,
  type RevealSurface,
  revealSurfaceFor,
} from "./reveal-path.ts";

const ROUTE_URL_BASE = "https://runtime-sweep.invalid";

type LandingAwareRoute = RevealRoute &
  Readonly<{ readonly landingRoute?: string | undefined }>;

const routeLandingUrl = (route: RevealRoute): string => {
  if (route.expectedOutcome !== undefined) {
    if (Object.hasOwn(route, "landingRoute"))
      throw new RevealDiscoveryError(
        "Resolver route cannot carry a static synthetic landing URL",
      );
    return route.expectedOutcome.expectedTarget;
  }
  const landingRoute = (route as LandingAwareRoute).landingRoute;
  if (landingRoute === undefined) return route.resolvedRoute;
  if (typeof landingRoute !== "string" || landingRoute.trim() === "")
    throw new RevealDiscoveryError(
      "Preflight route has an invalid landing URL declaration",
    );
  return landingRoute;
};

export const assertResolverOutcomeUi = (
  expected: ResolverOutcomeExpectation,
  inventory: DomInventory,
): void => {
  if (expected.expectedUi !== resolverExpectedUiFor(expected.identity.outcome))
    throw new RevealDiscoveryError(
      `Resolver expected UI contract is stale for ${expected.identity.stateId}`,
    );
  const visibleText = inventory.visibleText;
  if (visibleText === undefined)
    throw new RevealDiscoveryError(
      `Resolver outcome ${expected.identity.outcome} lacks visible UI text evidence`,
    );
  resolverOutcomeUiAssertions[expected.identity.outcome](
    expected,
    inventory,
    visibleText,
  );
};

type ResolverOutcomeUiAssertion = (
  expected: ResolverOutcomeExpectation,
  inventory: DomInventory,
  visibleText: string,
) => void;

const resolverOutcomeUiAssertions: Record<
  ResolverOutcomeKind,
  ResolverOutcomeUiAssertion
> = {
  "visible-current": (expected, _inventory, visibleText) => {
    if (!visibleText.includes("Status Report"))
      throw new RevealDiscoveryError(
        `Resolver outcome ${expected.identity.outcome} did not render the report-detail surface`,
      );
  },
  "published-fallback": (expected, _inventory, visibleText) => {
    if (!visibleText.includes("Status Report"))
      throw new RevealDiscoveryError(
        `Resolver outcome ${expected.identity.outcome} did not render the report-detail surface`,
      );
  },
  empty: (_expected, _inventory, visibleText) => {
    if (!visibleText.includes("There is no report to show yet."))
      throw new RevealDiscoveryError(
        "Resolver empty outcome did not render the exact empty-state text",
      );
  },
  "query-error": (_expected, inventory, visibleText) => {
    const hasRetry = inventory.controls.some(
      (control) =>
        control.role === "button" && control.accessibleName === "Try again",
    );
    if (!visibleText.includes("Could not load the status report.") || !hasRetry)
      throw new RevealDiscoveryError(
        "Resolver query-error outcome lacks the exact error text and retry control",
      );
  },
  anonymous: (_expected, inventory, visibleText) => {
    const hasLogin = inventory.controls.some(
      (control) =>
        control.role === "link" &&
        (control.accessibleName === "Sign in with corporate SSO" ||
          control.accessibleName.startsWith("Enter application as ")),
    );
    if (!visibleText.includes("Status Reporting System") || !hasLogin)
      throw new RevealDiscoveryError(
        "Resolver anonymous outcome did not render the auth boundary",
      );
  },
};

const canonicalLandingUrl = (route: RevealRoute): string => {
  const landingRoute = (route as LandingAwareRoute).landingRoute;
  if (typeof landingRoute !== "string" || landingRoute.trim() === "")
    throw new RevealDiscoveryError(
      "Preflight route lacks an exact landing URL declaration",
    );
  try {
    return canonicalRevealUrlFor(landingRoute);
  } catch (error: unknown) {
    throw new RevealDiscoveryError(
      `Preflight landing URL is invalid: ${
        error instanceof Error ? error.message : "invalid URL"
      }`,
    );
  }
};

const browserUrlFor = (value: unknown): URL => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    typeof value !== "string" ||
    normalized === "" ||
    normalized.toLocaleLowerCase().startsWith("about:")
  )
    throw new RevealDiscoveryError(
      "Browser preflight did not provide a current URL",
    );
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new TypeError("Browser URL must use HTTP or HTTPS");
    return url;
  } catch (error: unknown) {
    throw new RevealDiscoveryError(
      `Browser preflight current URL is invalid: ${
        error instanceof Error ? error.message : "invalid URL"
      }`,
    );
  }
};

export const requiredCurrentUrl = (value: unknown): string =>
  canonicalRevealUrlFor(browserUrlFor(value).href);

const requiredBrowserOrigin = (value: unknown): string =>
  browserUrlFor(value).origin;

export const assertSameRevealOrigin = (
  before: unknown,
  after: unknown,
): void => {
  if (browserUrlFor(before).origin !== browserUrlFor(after).origin)
    throw new RevealDiscoveryError("Reveal action left the browser origin");
};

export const assertInitialLanding = (
  route: RevealRoute,
  value: unknown,
  expectedOrigin: unknown,
): string => {
  if (
    route.expectedOutcome !== undefined &&
    Object.hasOwn(route, "landingRoute")
  )
    throw new RevealDiscoveryError(
      "Resolver route cannot carry a static synthetic landing URL",
    );
  const actualUrl = browserUrlFor(value);
  const canonicalExpectedOrigin = requiredBrowserOrigin(expectedOrigin);
  if (actualUrl.origin !== canonicalExpectedOrigin)
    throw new RevealDiscoveryError(
      `Browser did not settle at declared landing origin: expected=${canonicalExpectedOrigin} actual=${actualUrl.origin}`,
    );
  const actual = canonicalRevealUrlFor(actualUrl.href);
  const expected =
    route.expectedOutcome === undefined
      ? canonicalLandingUrl(route)
      : canonicalRevealUrlFor(route.expectedOutcome.expectedTarget);
  if (actual !== expected)
    throw new RevealDiscoveryError(
      route.expectedOutcome === undefined
        ? `Browser did not settle at declared landing URL: expected=${expected} actual=${actual}`
        : `Resolver outcome target mismatch: expected=${expected} actual=${actual}`,
    );
  return actual;
};

export const sameRevealRoutePath = (route: RevealRoute, url: string): boolean =>
  new URL(url, ROUTE_URL_BASE).pathname ===
  new URL(routeLandingUrl(route), ROUTE_URL_BASE).pathname;

export const assertRoutePath = (route: RevealRoute, url: string): void => {
  const currentUrl = canonicalRevealUrlFor(url);
  if (!sameRevealRoutePath(route, currentUrl))
    throw new RevealDiscoveryError(
      `Reveal action left nominal route pathname: ${currentUrl}`,
    );
};

export const assertInitialInventory = (
  expected: RevealSurface,
  actual: DomInventory,
): void => {
  const surface = revealSurfaceFor(actual.controls);
  if (
    surface.digest !== expected.digest ||
    stableSerialize(surface) !== stableSerialize(expected)
  )
    throw new RevealDiscoveryError(
      "Canonical initial inventory changed during branch reset",
    );
};

export const assertNonMutation = (execution: RevealExecution): void => {
  const proof = revealNonMutationProofSchema.safeParse(execution.nonMutation);
  if (!proof.success || proof.data.beforeDigest !== proof.data.afterDigest)
    throw new RevealDiscoveryError(
      "Reveal action lacks an unchanged database-oracle proof",
    );
};
