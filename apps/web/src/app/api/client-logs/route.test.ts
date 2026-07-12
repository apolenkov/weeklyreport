import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/server/api-url", () => ({
  requireApiUrl: () => "http://api.test:3002",
}));

import { POST } from "./route";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://web.test/api/client-logs", {
    method: "POST",
    headers,
    body: JSON.stringify({ entries: [] }),
  });
}

describe("client-logs proxy route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes the edge proxy's X-Forwarded-For chain through to the API", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      // NextRequest is structurally a Request for this handler's usage.
      makeRequest({
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
      }) as never,
    );

    expect(res.status).toBe(204);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe(
      "203.0.113.7",
    );
  });

  it("omits X-Forwarded-For when the incoming request carries none", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(makeRequest({ "content-type": "application/json" }) as never);

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(new Headers(init.headers).get("x-forwarded-for")).toBeNull();
  });
});
