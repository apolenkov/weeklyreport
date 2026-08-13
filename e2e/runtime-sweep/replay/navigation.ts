const NAVIGATION_ABORT_PATTERNS = [
  /\b(?:net::)?ERR_ABORTED\b/u,
  /\bNS_BINDING_ABORTED\b/u,
  /\bis interrupted by another navigation to\b/u,
] as const;
const APP_READY_SELECTOR = "#main-content";
const APP_LOADING_SELECTOR =
  '[aria-busy="true"], [data-slot="skeleton"], .skeleton, .animate-pulse';
const REVEAL_OVERLAY_SELECTOR =
  '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]';
const APP_READY_ARGUMENT = {
  rootSelector: APP_READY_SELECTOR,
  loadingSelector: APP_LOADING_SELECTOR,
} as const;
const REVEAL_READY_ARGUMENT = {
  ...APP_READY_ARGUMENT,
  overlaySelector: REVEAL_OVERLAY_SELECTOR,
} as const;
const APP_READY_TIMEOUT_MS = 10_000;
const APP_READY_STABILITY_PASSES = 2;

export interface AppReadyArgument {
  readonly rootSelector: string;
  readonly loadingSelector: string;
  readonly overlaySelector?: string;
  readonly requireAnimationsSettled?: boolean;
}

export interface AppReadyPage {
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
      const heading = main.querySelector("h1");
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
        heading !== null &&
        busy !== "true" &&
        hidden !== "true" &&
        main.getClientRects().length > 0 &&
        !hasVisibleLoadingMarker
      );
    },
    APP_READY_ARGUMENT,
    { polling: "raf", timeout: APP_READY_TIMEOUT_MS },
  );

function isRevealSurfaceReady({
  rootSelector,
  loadingSelector,
  overlaySelector,
  requireAnimationsSettled,
}: AppReadyArgument): boolean {
  if (overlaySelector === undefined) return false;
  const main = document.querySelector(rootSelector);
  if (!(main instanceof HTMLElement)) return false;
  const heading = main.querySelector("h1");
  const busy = main.getAttribute("aria-busy")?.toLocaleLowerCase();
  const hidden = main.ariaHidden?.toLocaleLowerCase();
  const isVisibleLoadingMarker = (marker: Element): boolean => {
    const markerHidden = marker.ariaHidden?.toLocaleLowerCase();
    return markerHidden !== String(true) && marker.getClientRects().length > 0;
  };
  const overlays = Array.from(
    document.querySelectorAll(overlaySelector),
  ).filter((overlay) => {
    const overlayHidden = overlay.ariaHidden?.toLocaleLowerCase();
    return (
      overlayHidden !== String(true) &&
      !main.contains(overlay) &&
      overlay.closest('[aria-hidden="true"]') === null &&
      overlay.getClientRects().length > 0
    );
  });
  const hasVisibleLoadingMarker = [main, ...overlays].some(
    (container) =>
      container.matches(loadingSelector) ||
      Array.from(container.querySelectorAll(loadingSelector)).some(
        isVisibleLoadingMarker,
      ),
  );
  const animationsSettled =
    !requireAnimationsSettled ||
    (() => {
      if (typeof document.getAnimations !== "function") return false;
      const animations = (() => {
        try {
          return document.getAnimations();
        } catch {
          return undefined;
        }
      })();
      if (animations === undefined) return false;
      return animations.every((animation) => {
        try {
          const timing = animation.effect?.getComputedTiming();
          if (timing?.iterations === Infinity) return true;
          if (typeof timing?.duration !== "number") return false;
          return (
            animation.playState === "finished" || animation.playState === "idle"
          );
        } catch {
          return false;
        }
      });
    })();
  return (
    heading !== null &&
    busy !== String(true) &&
    (hidden !== String(true) || overlays.length > 0) &&
    main.getClientRects().length > 0 &&
    !hasVisibleLoadingMarker &&
    animationsSettled
  );
}

const waitForRevealReadyPass = (
  page: AppReadyPage,
  requireAnimationsSettled = false,
): Promise<unknown> =>
  page.waitForFunction(
    isRevealSurfaceReady,
    requireAnimationsSettled
      ? { ...REVEAL_READY_ARGUMENT, requireAnimationsSettled: true }
      : REVEAL_READY_ARGUMENT,
    { polling: "raf", timeout: APP_READY_TIMEOUT_MS },
  );

export async function waitForAppReady(page: AppReadyPage): Promise<void> {
  await Array.from({ length: APP_READY_STABILITY_PASSES }).reduce(
    async (previous) => {
      await previous;
      return waitForReadyPass(page);
    },
    Promise.resolve(),
  );
}

export async function waitForRevealSurfaceReady(
  page: AppReadyPage,
): Promise<void> {
  await waitForRevealReadyPass(page);
  await waitForRevealReadyPass(page, true);
}

export async function settleNavigation(
  page: NavigationSettlePage,
): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
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
      timeout: 10_000,
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
