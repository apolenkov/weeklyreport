import { z } from "zod";

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const RUNTIME_SWEEP_ENDPOINT = "http://localhost:8931/mcp";
const RUNTIME_SWEEP_TOOLS = [
  "browser_click",
  "browser_console_messages",
  "browser_evaluate",
  "browser_navigate",
  "browser_network_requests",
  "browser_snapshot",
  "browser_wait_for",
] as const;
const sessionHeader = "mcp-session-id";
const toolListSchema = z.object({
  result: z.object({
    tools: z.array(z.object({ name: z.string().min(1) }).loose()),
  }),
});

export type McpFetch = typeof fetch;

export class PlaywrightMcpPreflightError extends Error {
  override readonly name = "PlaywrightMcpPreflightError";
}

const requestBody = (id: number, method: string, params: unknown) =>
  JSON.stringify({ jsonrpc: "2.0", id, method, params });

async function postMcp(
  fetcher: McpFetch,
  endpoint: string,
  body: string,
  sessionId?: string,
): Promise<Response> {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body,
  });
  if (!response.ok)
    throw new PlaywrightMcpPreflightError(
      `Playwright MCP returned HTTP ${response.status}`,
    );
  return response;
}

async function parseMcpResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data:"))
    ?.slice("data:".length)
    .trim();
  try {
    return JSON.parse(data ?? text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new PlaywrightMcpPreflightError(
        "Playwright MCP returned malformed JSON",
      );
    throw error;
  }
}

export async function assertPlaywrightMcpTools(
  endpoint: string,
  requiredTools: readonly string[],
  fetcher: McpFetch = fetch,
): Promise<void> {
  const initialize = await postMcp(
    fetcher,
    endpoint,
    requestBody(1, "initialize", {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "runtime-sweep-preflight", version: "1" },
    }),
  );
  await parseMcpResponse(initialize);
  const sessionId = initialize.headers.get(sessionHeader);
  if (!sessionId)
    throw new PlaywrightMcpPreflightError(
      "Playwright MCP did not return a session id",
    );
  const toolsResponse = await postMcp(
    fetcher,
    endpoint,
    requestBody(2, "tools/list", {}),
    sessionId,
  );
  const parsed = toolListSchema.safeParse(
    await parseMcpResponse(toolsResponse),
  );
  if (!parsed.success)
    throw new PlaywrightMcpPreflightError(
      "Playwright MCP returned an invalid tools/list result",
    );
  const available = new Set(parsed.data.result.tools.map(({ name }) => name));
  const missing = requiredTools.filter((tool) => !available.has(tool));
  if (missing.length > 0)
    throw new PlaywrightMcpPreflightError(
      `Playwright MCP is missing tools: ${missing.join(", ")}`,
    );
}

export const assertRuntimeSweepPlaywrightMcpTools = (): Promise<void> =>
  assertPlaywrightMcpTools(RUNTIME_SWEEP_ENDPOINT, RUNTIME_SWEEP_TOOLS);
