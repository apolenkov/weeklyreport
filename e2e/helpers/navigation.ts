const NAVIGATION_ABORT_PATTERNS = [
  /\b(?:net::)?ERR_ABORTED\b/u,
  /\bNS_BINDING_ABORTED\b/u,
  /\bis interrupted by another navigation to\b/u,
] as const;
const APP_READY_ARGUMENT = {
  rootSelector: "#main-content",
  loadingSelector:
    '[aria-busy="true"], [data-slot="skeleton"], .skeleton, .animate-pulse',
} as const;
const APP_READY_TIMEOUT_MS = 10_000;
const APP_READY_STABILITY_PASSES = 2;
const NETWORK_IDLE_TIMEOUT_MS = 3000;

interface AppReadyArgument {
  readonly rootSelector: string;
  readonly loadingSelector: string;
}

interface AppReadyPage {
  readonly waitForFunction: (
    predicate: (argument: AppReadyArgument) => boolean,
    argument?: AppReadyArgument,
    options?: Readonly<{
      readonly polling?: "raf";
      readonly timeout?: number;
    }>,
  ) => Promise<unknown>;
}

export interface NavigationSettlePage extends AppReadyPage {
  readonly waitForLoadState: (
    state?: "load" | "domcontentloaded" | "networkidle",
    options?: Readonly<{ readonly timeout?: number }>,
  ) => Promise<void>;
}

export interface NavigationPage extends NavigationSettlePage {
  readonly url: () => string;
  readonly goto: (
    route: string,
    options?: Readonly<{ readonly waitUntil?: "domcontentloaded" }>,
  ) => Promise<Readonly<{ readonly status: () => number }> | null>;
  readonly waitForURL: (
    predicate: (url: URL) => boolean,
    options?: Readonly<{
      readonly waitUntil?: "domcontentloaded";
      readonly timeout?: number;
    }>,
  ) => Promise<void>;
}

export function isExpectedNavigationAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    NAVIGATION_ABORT_PATTERNS.some((pattern) => pattern.test(error.message))
  );
}

const waitForReadyPass = (page: AppReadyPage): Promise<unknown> =>
  page.waitForFunction(
    ({ rootSelector, loadingSelector }: AppReadyArgument) => {
      const main = document.querySelector(rootSelector);
      if (!(main instanceof HTMLElement)) return false;
      const busy = main.getAttribute("aria-busy")?.toLocaleLowerCase();
      const hidden = main.getAttribute("aria-hidden")?.toLocaleLowerCase();
      const hasVisibleLoadingMarker = Array.from(
        main.querySelectorAll(loadingSelector),
      ).some((marker) => {
        const markerHidden = marker
          .getAttribute("aria-hidden")
          ?.toLocaleLowerCase();
        return markerHidden !== "true" && marker.getClientRects().length > 0;
      });
      return (
        main.querySelector("h1") !== null &&
        busy !== "true" &&
        hidden !== "true" &&
        main.getClientRects().length > 0 &&
        !hasVisibleLoadingMarker
      );
    },
    APP_READY_ARGUMENT,
    { polling: "raf", timeout: APP_READY_TIMEOUT_MS },
  );

async function waitForAppReady(page: AppReadyPage): Promise<void> {
  await Array.from({ length: APP_READY_STABILITY_PASSES }).reduce(
    async (previous) => {
      await previous;
      return waitForReadyPass(page);
    },
    Promise.resolve(),
  );
}

export async function settleNavigation(
  page: NavigationSettlePage,
): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", {
      timeout: NETWORK_IDLE_TIMEOUT_MS,
    });
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
  }
  await waitForAppReady(page);
}

async function waitForFinalNavigation(
  page: NavigationPage,
  initialUrl: string,
): Promise<void> {
  if (page.url() === initialUrl) {
    await page.waitForURL((url) => url.toString() !== initialUrl, {
      waitUntil: "domcontentloaded",
      timeout: APP_READY_TIMEOUT_MS,
    });
  }
  await settleNavigation(page);
}

export async function navigate(
  page: NavigationPage,
  route: string,
): Promise<number | null> {
  const currentUrl = page.url();
  const initialUrl =
    currentUrl === "about:blank"
      ? route
      : new URL(route, currentUrl).toString();
  try {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    await settleNavigation(page);
    return response?.status() ?? null;
  } catch (error: unknown) {
    if (!isExpectedNavigationAbort(error)) throw error;
    await waitForFinalNavigation(page, initialUrl);
    return null;
  }
}
