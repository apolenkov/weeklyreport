import type { Page } from "@playwright/test";

import type { RuntimeEventWindow } from "./frozen-case-live-capture-types.ts";
import { settleNavigation } from "./navigation.ts";
import { eventsFor } from "./runtime-matrix-evidence.ts";

export const initialNavigation = async (
  page: Page,
  route: string,
): Promise<
  Readonly<{ responseStatus: number | null; events: RuntimeEventWindow }>
> => {
  const listeners = eventsFor(page);
  try {
    const response = await page.goto(route);
    await settleNavigation(page);
    return {
      responseStatus: response?.status() ?? null,
      events: {
        consoleMessages: [...listeners.consoleMessages],
        pageErrors: [...listeners.pageErrors],
        requestFailures: [...listeners.requestFailures],
      },
    };
  } finally {
    listeners.detach();
  }
};
