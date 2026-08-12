import type { Page } from "@playwright/test";

import { eventsFor } from "../matrix/runtime-matrix-evidence.ts";
import {
  assertInitialLanding,
  assertResolverOutcomeUi,
} from "../preflight/preflight-reveal-guards.ts";
import type { ResolverOutcomeExpectation } from "../support/resolver-outcome-expectations.ts";
import { inventoryDom } from "./dom-inventory.ts";
import type { RuntimeEventWindow } from "./frozen-case-live-capture-types.ts";
import { settleNavigation } from "./navigation.ts";

export const initialNavigation = async (
  page: Page,
  route: string,
  landingRoute: string | undefined,
  expectedOrigin: string,
  expectedOutcome?: ResolverOutcomeExpectation,
): Promise<
  Readonly<{ responseStatus: number | null; events: RuntimeEventWindow }>
> => {
  const startedAt = new Date().toISOString();
  const listeners = eventsFor(page);
  const cursor = listeners.cursor();
  try {
    const response = await page.goto(route);
    await settleNavigation(page);
    assertInitialLanding(
      {
        resolvedRoute: route,
        ...(landingRoute === undefined ? {} : { landingRoute }),
        ...(expectedOutcome === undefined ? {} : { expectedOutcome }),
      },
      page.url(),
      expectedOrigin,
    );
    if (expectedOutcome !== undefined)
      assertResolverOutcomeUi(expectedOutcome, await inventoryDom(page));
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
