import type { Page } from "@playwright/test";

const NAVIGATION_ABORT_PATTERNS = [
  /\b(?:net::)?ERR_ABORTED\b/u,
  /\bNS_BINDING_ABORTED\b/u,
  /\bis interrupted by another navigation to\b/u,
] as const;
const APP_READY_SELECTOR = "#main-content";
const APP_READY_TIMEOUT_MS = 10_000;

export function isExpectedNavigationAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    NAVIGATION_ABORT_PATTERNS.some((pattern) => pattern.test(error.message))
  );
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    (selector: string) => {
      const main = document.querySelector(selector);
      if (!(main instanceof HTMLElement)) return false;
      const heading = document.querySelector("h1");
      const busy = main.getAttribute("aria-busy")?.toLocaleLowerCase();
      const hidden = main.getAttribute("aria-hidden")?.toLocaleLowerCase();
      return (
        heading !== null &&
        busy !== "true" &&
        hidden !== "true" &&
        main.getClientRects().length > 0
      );
    },
    APP_READY_SELECTOR,
    { polling: "raf", timeout: APP_READY_TIMEOUT_MS },
  );
}

export async function settleNavigation(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
  }
  await waitForAppReady(page);
}

async function waitForFinalNavigation(
  page: Page,
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
  page: Page,
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
