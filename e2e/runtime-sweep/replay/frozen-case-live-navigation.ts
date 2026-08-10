import type { Page } from "@playwright/test";

import { eventsFor } from "../matrix/runtime-matrix-evidence.ts";
import type { RuntimeEventWindow } from "./frozen-case-live-capture-types.ts";
import { settleNavigation } from "./navigation.ts";

export const initialNavigation = async (
  page: Page,
  route: string,
): Promise<
  Readonly<{ responseStatus: number | null; events: RuntimeEventWindow }>
> => {
  const startedAt = new Date().toISOString();
  const listeners = eventsFor(page);
  const cursor = listeners.cursor();
  try {
    const response = await page.goto(route);
    await settleNavigation(page);
    return {
      responseStatus: response?.status() ?? null,
      events: {
        startedAt,
        cursor,
        collector: listeners,
      },
    };
  } catch (error: unknown) {
    listeners.detach();
    throw error;
  }
};
