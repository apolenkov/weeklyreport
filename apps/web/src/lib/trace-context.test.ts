import { afterEach, describe, expect, it, vi } from "vitest";

import { createTraceparent, fetchWithTraceparent } from "./trace-context";

const TRACEPARENT_PATTERN = /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/;

describe("trace context", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a valid W3C traceparent", () => {
    expect(createTraceparent()).toMatch(TRACEPARENT_PATTERN);
  });

  it("attaches traceparent to outgoing fetch calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithTraceparent("/trpc", {
      headers: { "x-request-kind": "batch" },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(options?.headers);
    expect(headers.get("traceparent")).toMatch(TRACEPARENT_PATTERN);
    expect(headers.get("x-request-kind")).toBe("batch");
    expect(options?.credentials).toBe("include");
  });
});
