import { describe, expect, it } from "vitest";

import {
  VIEWER_STATUS_FAULT_BODY,
  VIEWER_STATUS_FAULT_ID,
  VIEWER_STATUS_OPERATION,
  VIEWER_STATUS_PATH,
  withResolverQueryFault,
} from "./resolver-query-fault.ts";

type RouteHandler = (route: {
  request: () => { url: () => string; method: () => string };
  continue: () => Promise<void>;
  fulfill: (input: {
    status: number;
    headers: Record<string, string>;
    body: string;
  }) => Promise<void>;
}) => Promise<void>;

const fakePage = () => {
  let handler: RouteHandler | undefined;
  let unrouteCount = 0;
  return {
    page: {
      route: (_pattern: string, value: RouteHandler) => {
        handler = value;
        return Promise.resolve();
      },
      unroute: (_pattern: string, value: RouteHandler) => {
        if (handler !== value) throw new Error("wrong resolver fault handler");
        unrouteCount += 1;
        handler = undefined;
        return Promise.resolve();
      },
    } as unknown as import("@playwright/test").Page,
    handler: () => {
      if (handler === undefined)
        throw new Error("fault handler is not installed");
      return handler;
    },
    unrouteCount: () => unrouteCount,
  };
};

const request = (url: string, method = "GET") => ({
  url: () => url,
  method: () => method,
});

describe("viewer status resolver fault", () => {
  it("injects exactly one GET fault for the exact resolver operation and tears down", async () => {
    const fake = fakePage();
    const result = await withResolverQueryFault(fake.page, async () => {
      let response: { status?: number; body?: string } = {};
      await fake.handler()({
        request: () =>
          request(`https://runtime.test${VIEWER_STATUS_PATH}?batch=1`),
        continue: () => Promise.resolve(),
        fulfill: (input) => {
          response = { status: input.status, body: input.body };
          return Promise.resolve();
        },
      });
      expect(response.status).toBe(503);
      expect(response.body).toBe(VIEWER_STATUS_FAULT_BODY);
      return response;
    });
    expect(result.fault).toMatchObject({
      operation: VIEWER_STATUS_OPERATION,
      path: VIEWER_STATUS_PATH,
      method: "GET",
      status: 503,
      count: 1,
    });
    expect(VIEWER_STATUS_FAULT_ID).toBe("viewer-status-query-error");
    expect(fake.unrouteCount()).toBe(1);
  });

  it("does not count another method or route as the declared resolver fault", async () => {
    const fake = fakePage();
    await expect(
      withResolverQueryFault(fake.page, async () => {
        await fake.handler()({
          request: () =>
            request(`https://runtime.test${VIEWER_STATUS_PATH}`, "POST"),
          continue: () => Promise.resolve(),
          fulfill: () => Promise.reject(new Error("unexpected fulfill")),
        });
        await fake.handler()({
          request: () =>
            request("https://runtime.test/trpc/reports.other", "GET"),
          continue: () => Promise.resolve(),
          fulfill: () => Promise.reject(new Error("unexpected fulfill")),
        });
      }),
    ).rejects.toThrow(
      "Expected exactly one reports.latestForViewer fault, observed 0",
    );
    expect(fake.unrouteCount()).toBe(1);
  });
});
