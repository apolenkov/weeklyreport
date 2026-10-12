import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/server/transport/api-url", () => ({
  requireApiUrl: () => "http://api.test:3002",
  SERVER_FETCH_TIMEOUT_MS: 1000,
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

function makeStreamRequest(
  chunks: readonly Uint8Array[],
  headers: Record<string, string>,
  onCancel?: () => void,
): NextRequest {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      // Deliberately left open: a bounded reader must not wait for EOF.
    },
    cancel() {
      onCancel?.();
    },
  });
  return new NextRequest("http://web.test/api/client-logs", {
    method: "POST",
    headers,
    duplex: "half",
    body: stream,
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
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
    if (!req.body) throw new TypeError("Expected a request body stream");
    const readerSpy = vi.spyOn(req.body, "getReader");

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(readerSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a chunked stream crossing the limit without waiting for EOF", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onCancel = vi.fn();
    const chunk = new Uint8Array(64 * 1024).fill(120);

    const res = await POST(
      makeStreamRequest(
        [chunk, chunk, chunk],
        { "content-type": "application/json" },
        onCancel,
      ),
    );

    expect(res.status).toBe(413);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not let a small declared Content-Length bypass the stream bound", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onCancel = vi.fn();
    const chunk = new Uint8Array(64 * 1024).fill(120);

    const res = await POST(
      makeStreamRequest(
        [chunk, chunk, chunk],
        { "content-type": "application/json", "content-length": "1" },
        onCancel,
      ),
    );

    expect(res.status).toBe(413);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["NaN", "1, 2", "not-a-number"])(
    "bounds malformed Content-Length %j and releases the request lock",
    async (contentLength) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const onCancel = vi.fn();
      const chunk = new Uint8Array(64 * 1024).fill(120);
      const request = makeStreamRequest(
        [chunk, chunk, chunk],
        { "content-type": "application/json", "content-length": contentLength },
        onCancel,
      );
      const response = await POST(request);
      expect(response.status).toBe(413);
      expect(onCancel).toHaveBeenCalledOnce();
      expect(request.body?.locked).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("forwards a body of exactly the byte limit unchanged", async () => {
    const payload = JSON.stringify({ message: "é".repeat(65_529) });
    expect(new TextEncoder().encode(payload).byteLength).toBe(128 * 1024);
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeRequest({ "content-type": "application/json" }, payload),
    );

    expect(res.status).toBe(204);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new TypeError("Expected fetch call");
    const [, init] = call;
    if (!init) throw new TypeError("Expected fetch options");
    expect(init.body).toBe(payload);
  });
});
