import { afterEach, describe, expect, it, vi } from "vitest";

import { isProgressiveDashboardProcedure, makeTRPCClient } from "./trpc";

const TRPC_PATH_PATTERN = /\/trpc\/([^?]+)/;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("progressive dashboard transport", () => {
  it.each([
    "admin.listReopenRequests",
    "activity.live",
    "review.dashboard",
    "weeklyReport.get",
  ])("isolates %s from shared batches", (path) => {
    expect(isProgressiveDashboardProcedure(path)).toBe(true);
  });

  it("keeps unrelated procedures on the shared transport", () => {
    expect(isProgressiveDashboardProcedure("auth.me")).toBe(false);
  });

  it("issues one request per concurrently started dashboard source", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        requestedUrls.push(requestUrl(input));
        return Promise.resolve(
          new Response(JSON.stringify([{ result: { data: { json: null } } }]), {
            headers: { "content-type": "application/json" },
            status: 200,
          }),
        );
      }),
    );

    const client = makeTRPCClient();
    await Promise.all([
      client.admin.listReopenRequests.query({ status: "pending" }),
      client.activity.live.query(),
      client.review.dashboard.query(),
      client.weeklyReport.get.query({}),
    ]);

    expect(requestedUrls).toHaveLength(4);
    expect(
      requestedUrls.map(
        (url) => TRPC_PATH_PATTERN.exec(decodeURIComponent(url))?.[1],
      ),
    ).toEqual(
      expect.arrayContaining([
        "admin.listReopenRequests",
        "activity.live",
        "review.dashboard",
        "weeklyReport.get",
      ]),
    );
    expect(requestedUrls.every((url) => !url.includes(","))).toBe(true);
  });
});
