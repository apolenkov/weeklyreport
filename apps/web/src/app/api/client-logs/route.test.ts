import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/server/transport/api-url", () => ({
  requireApiUrl: () => "http://api.test:3002",
}));

import { CLIENT_LOGS_MAX_BODY_BYTES } from "../../../features/telemetry/server";
import { POST } from "./route";

function makeRequest(
  headers: Record<string, string>,
  body = JSON.stringify({ entries: [] }),
): NextRequest {
  return new NextRequest("http://web.test/api/client-logs", {
    method: "POST",
    headers,
    body,
  });
}

describe("client-logs proxy route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pins the public body limit at 128 KiB", () => {
    expect(CLIENT_LOGS_MAX_BODY_BYTES).toBe(128 * 1024);
  });

  it("passes the edge proxy's X-Forwarded-For chain through to the API", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeRequest({
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
      }),
    );

    expect(res.status).toBe(202);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new TypeError("Expected fetch call");
    const [, init] = call;
    if (!init) throw new TypeError("Expected fetch options");
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe(
      "203.0.113.7",
    );
  });

  it("omits X-Forwarded-For when the incoming request carries none", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(makeRequest({ "content-type": "application/json" }));

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new TypeError("Expected fetch call");
    const [, init] = call;
    if (!init) throw new TypeError("Expected fetch options");
    expect(new Headers(init.headers).get("x-forwarded-for")).toBeNull();
  });

  it("rejects an oversized body without forwarding it to the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeRequest(
        { "content-type": "application/json" },
        "x".repeat(CLIENT_LOGS_MAX_BODY_BYTES + 1),
      ),
    );

    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = makeRequest({
      "content-type": "application/json",
      "content-length": String(CLIENT_LOGS_MAX_BODY_BYTES + 1),
    });
    const textSpy = vi.spyOn(req, "text");

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(textSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
