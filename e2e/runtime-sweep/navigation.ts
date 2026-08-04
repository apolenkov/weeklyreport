import type { Page } from "@playwright/test";

const NAVIGATION_ABORT_PATTERNS = [
  /\b(?:net::)?ERR_ABORTED\b/u,
  /\bNS_BINDING_ABORTED\b/u,
  /\bis interrupted by another navigation to\b/u,
] as const;

export function isExpectedNavigationAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    NAVIGATION_ABORT_PATTERNS.some((pattern) => pattern.test(error.message))
  );
}

async function settle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
  }
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
  await settle(page);
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
    await settle(page);
    return response?.status() ?? null;
  } catch (error: unknown) {
    if (!isExpectedNavigationAbort(error)) throw error;
    await waitForFinalNavigation(page, initialUrl);
    return null;
  }
}
