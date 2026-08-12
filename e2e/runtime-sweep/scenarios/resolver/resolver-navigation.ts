import type { Page, Response } from "@playwright/test";

export const REPORTS_LATEST = "/reports/latest" as const;

export const navigateToResolverRequest = async (
  page: Page,
  responsePromise: Promise<Response>,
): Promise<Response> => {
  await page.goto(REPORTS_LATEST);
  return responsePromise;
};
