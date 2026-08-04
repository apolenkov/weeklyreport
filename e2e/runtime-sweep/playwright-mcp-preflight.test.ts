import { describe, expect, it, vi } from "vitest";

import {
  assertPlaywrightMcpTools,
  PlaywrightMcpPreflightError,
} from "./playwright-mcp-preflight.ts";

const sse = (value: unknown, sessionId?: string): Response =>
  new Response(`event: message\ndata: ${JSON.stringify(value)}\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
  });

describe("Playwright MCP tool preflight", () => {
  it("proves the required tools through tools/list", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sse({ result: {} }, "session-1"))
      .mockResolvedValueOnce(
        sse({ result: { tools: [{ name: "browser_navigate" }] } }),
      );

    await expect(
      assertPlaywrightMcpTools(
        "http://localhost:8931/mcp",
        ["browser_navigate"],
        fetcher,
      ),
    ).resolves.toBeUndefined();
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({
      "Mcp-Session-Id": "session-1",
    });
  });

  it("fails when the server omits a required tool", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(sse({ result: {} }, "session-1"))
      .mockResolvedValueOnce(sse({ result: { tools: [] } }));

    await expect(
      assertPlaywrightMcpTools(
        "http://localhost:8931/mcp",
        ["browser_snapshot"],
        fetcher,
      ),
    ).rejects.toThrow(PlaywrightMcpPreflightError);
  });
});
