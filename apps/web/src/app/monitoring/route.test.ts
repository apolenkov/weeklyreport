import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import {
  consumeSentryTunnelQuota,
  resolveSentryEnvelopeEndpoint,
  resolveSentryTunnelClientKey,
  SENTRY_TUNNEL_MAX_BODY_BYTES,
  SENTRY_TUNNEL_MAX_CLIENT_BUCKETS,
  SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW,
  SENTRY_TUNNEL_RETRY_AFTER_SECONDS,
  SENTRY_TUNNEL_WINDOW_MS,
} from "./sentry-tunnel";
import { SentryTunnelQuota } from "./sentry-tunnel-quota";

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
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://other-key@other.test/99");
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeRequest({ "content-type": "application/x-sentry-envelope" }),
    );

    expect(res.status).toBe(200);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new TypeError("Expected fetch call");
    const [input, init] = call;
    expect(input).toBeInstanceOf(URL);
    if (!(input instanceof URL)) throw new TypeError("Expected a URL input");
    if (!init) throw new TypeError("Expected fetch options");
    expect(input.toString()).toBe(
      "https://bugsink.test/api/42/envelope/?sentry_version=7&sentry_key=public-key",
    );
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/x-sentry-envelope",
    );
    expect(await new Response(init.body).text()).toBe('{"envelope":true}');
  });

  it("falls back to the public DSN through the web env accessor", async () => {
    vi.stubEnv("SENTRY_DSN", undefined);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "https://bugsink.test/api/42/envelope/?sentry_version=7&sentry_key=public-key",
      ),
      expect.objectContaining({ method: "POST" }),
    );
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

  it("enforces a per-client request quota before forwarding", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const headers = { "x-forwarded-for": "198.51.100.10" };

    for (
      let index = 0;
      index < SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW;
      index += 1
    ) {
      await expect(POST(makeRequest(headers))).resolves.toMatchObject({
        status: 200,
      });
    }

    const limited = await POST(makeRequest(headers));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(
      String(SENTRY_TUNNEL_RETRY_AFTER_SECONDS),
    );
    expect(fetchMock).toHaveBeenCalledTimes(
      SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW,
    );
  });

  it("keeps quotas independent and bounded by client bucket count", () => {
    const quota = new SentryTunnelQuota(
      SENTRY_TUNNEL_WINDOW_MS,
      SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW,
      SENTRY_TUNNEL_MAX_CLIENT_BUCKETS,
      128,
    );
    const now = 1000;
    for (let index = 0; index < SENTRY_TUNNEL_MAX_CLIENT_BUCKETS; index += 1) {
      expect(quota.consume(`client-${index}`, now)).toBe(true);
    }
    expect(quota.consume("overflow-client", now)).toBe(false);
    expect(quota.consume("client-0", now)).toBe(true);
  });

  it("expires a client bucket after its fixed window", () => {
    const quota = new SentryTunnelQuota(
      SENTRY_TUNNEL_WINDOW_MS,
      SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW,
      SENTRY_TUNNEL_MAX_CLIENT_BUCKETS,
      128,
    );
    const now = 1000;
    for (
      let index = 0;
      index < SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW;
      index += 1
    ) {
      expect(quota.consume("expiring-client", now)).toBe(true);
    }

    expect(quota.consume("expiring-client", now)).toBe(false);
    expect(
      quota.consume("expiring-client", now + SENTRY_TUNNEL_WINDOW_MS),
    ).toBe(true);
  });

  it("uses the edge-provided real address before forwarded chains", () => {
    const request = makeRequest({
      "x-real-ip": "198.51.100.10",
      "x-forwarded-for": "203.0.113.20, 198.51.100.30",
    });

    expect(resolveSentryTunnelClientKey(request)).toBe("198.51.100.10");
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

  it("charges an oversized streaming attempt to the admission quota", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public-key@bugsink.test/42");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const clientKey = "198.51.100.44";
    const headers = { "x-real-ip": clientKey };

    const oversized = await POST(makeStreamingRequest(headers).request);
    expect(oversized.status).toBe(413);
    for (
      let admitted = 1;
      admitted < SENTRY_TUNNEL_MAX_REQUESTS_PER_WINDOW;
      admitted += 1
    ) {
      expect(consumeSentryTunnelQuota(clientKey)).toBe(true);
    }

    const limited = await POST(makeRequest(headers));
    expect(limited.status).toBe(429);
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
