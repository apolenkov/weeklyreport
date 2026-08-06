import type { Page } from "@playwright/test";

const isHttpOrigin = (url: string): boolean => /^https?:\/\//u.test(url);

export async function clearClientStorage(
  page: Page,
  baseURL?: string,
): Promise<void> {
  if (!isHttpOrigin(page.url())) {
    if (baseURL === undefined)
      throw new Error("Client storage reset requires an HTTP origin");
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
