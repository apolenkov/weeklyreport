import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import {
  resolveSentryEnvelopeEndpoint,
  SENTRY_TUNNEL_MAX_BODY_BYTES,
} from "./sentry-tunnel";

function makeRequest(
  headers: Record<string, string> = {},
  body = '{"envelope":true}',
): Request {
  return new Request("https://web.test/monitoring", {
    method: "POST",
    headers,
    body,
  });
}

function makeStreamingRequest(headers: Record<string, string> = {}): {
  request: Request;
  wasCancelled: () => boolean;
} {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(SENTRY_TUNNEL_MAX_BODY_BYTES));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://web.test/monitoring", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, wasCancelled: () => cancelled };
}

describe("same-origin Sentry tunnel route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("derives the Bugsink envelope endpoint and query auth from the DSN", () => {
    const endpoint = resolveSentryEnvelopeEndpoint(
      "http://public-key@bugsink.test:8000/sentry/42",
    );

    expect(endpoint?.toString()).toBe(
      "http://bugsink.test:8000/sentry/api/42/envelope/?sentry_version=7&sentry_key=public-key",
    );
  });

  it("forwards the raw envelope to the configured endpoint", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeRequest({ "content-type": "application/x-sentry-envelope" }),
    );

    expect(res.status).toBe(200);
    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(input.toString()).toBe(
      "https://bugsink.test/api/42/envelope/?sentry_version=7&sentry_key=public-key",
    );
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/x-sentry-envelope",
    );
    expect(await new Response(init.body).text()).toBe('{"envelope":true}');
  });

  it("does not make an upstream request when telemetry is unconfigured", async () => {
    vi.stubEnv("SENTRY_DSN", undefined);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest());

    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized envelope before forwarding it", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeRequest({
        "content-length": String(SENTRY_TUNNEL_MAX_BODY_BYTES + 1),
      }),
    );

    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a chunked request", {}],
    ["an invalid content length", { "content-length": "not-a-number" }],
  ])("cancels %s before forwarding it", async (_label, headers) => {
    vi.stubEnv("SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const streaming = makeStreamingRequest(headers);

    const res = await POST(streaming.request);

    expect(res.status).toBe(413);
    expect(streaming.wasCancelled()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows an upstream failure so telemetry cannot break the app", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn(() => Promise.reject(new Error("receiver down")));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest());

    expect(res.status).toBe(204);
  });
});
