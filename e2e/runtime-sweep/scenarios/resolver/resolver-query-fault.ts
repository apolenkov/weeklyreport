import type { Page, Route } from "@playwright/test";

export const VIEWER_STATUS_OPERATION = "reports.latestForViewer" as const;
export const VIEWER_STATUS_PATH = "/trpc/reports.latestForViewer" as const;
export const VIEWER_STATUS_FAULT_ID = "viewer-status-query-error" as const;
export const VIEWER_STATUS_FAULT_STATUS = 503;
const VIEWER_STATUS_FAULT_MESSAGE = "Status resolver temporarily unavailable";
export const VIEWER_STATUS_FAULT_BODY = JSON.stringify([
  {
    error: {
      json: {
        code: -32_603,
        message: VIEWER_STATUS_FAULT_MESSAGE,
      },
    },
  },
]);

const routePattern = "**/trpc/reports.latestForViewer**";
const responseBody = VIEWER_STATUS_FAULT_BODY;

export type ResolverFaultObservation = Readonly<{
  readonly operation: typeof VIEWER_STATUS_OPERATION;
  readonly path: typeof VIEWER_STATUS_PATH;
  readonly method: "GET";
  readonly status: typeof VIEWER_STATUS_FAULT_STATUS;
  readonly count: 1;
}>;

class ResolverFaultError extends Error {
  override readonly name = "ResolverFaultError";
}

const handlerFor =
  (state: { count: number }): ((route: Route) => Promise<void>) =>
  async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname !== VIEWER_STATUS_PATH || request.method() !== "GET") {
      await route.continue();
      return;
    }
    state.count += 1;
    if (state.count !== 1) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: VIEWER_STATUS_FAULT_STATUS,
      headers: { "content-type": "application/json" },
      body: responseBody,
    });
  };

export async function withResolverQueryFault<T>(
  page: Page,
  action: () => Promise<T>,
): Promise<
  Readonly<{ readonly result: T; readonly fault: ResolverFaultObservation }>
> {
  const state = { count: 0 };
  const handler = handlerFor(state);
  await page.route(routePattern, handler);
  try {
    const result = await action();
    if (state.count !== 1)
      throw new ResolverFaultError(
        `Expected exactly one ${VIEWER_STATUS_OPERATION} fault, observed ${state.count}`,
      );
    return {
      result,
      fault: {
        operation: VIEWER_STATUS_OPERATION,
        path: VIEWER_STATUS_PATH,
        method: "GET",
        status: VIEWER_STATUS_FAULT_STATUS,
        count: 1,
      },
    };
  } finally {
    await page.unroute(routePattern, handler);
  }
}
