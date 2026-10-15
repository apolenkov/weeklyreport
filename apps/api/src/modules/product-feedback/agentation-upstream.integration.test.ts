import { randomUUID } from "node:crypto";
import { Server as HttpServer } from "node:http";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  agentationAnnotationResponseSchema,
  agentationSessionResponseSchema,
  agentationSseEventSchema,
} from "@weeklyreport/shared";
import pg from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";

import { startAgentationContractServer } from "../../test-utils/agentation-contract-server";
import {
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { getAgentationSseConnectionCounts } from "./agentation-sse";

async function expectHttpStatus(
  response: Response,
  expected: number,
): Promise<void> {
  if (response.status === expected) return;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  const error =
    typeof body === "object" && body !== null && "error" in body
      ? body.error
      : undefined;
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? body.message
      : undefined;
  const errorContext = typeof error === "string" ? `; error=${error}` : "";
  const messageContext =
    typeof message === "string" ? `; message=${message}` : "";
  throw new Error(
    `Expected HTTP ${expected}, received ${response.status}${errorContext}${messageContext}`,
  );
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).not.toBe(true);
  const content = z
    .array(z.object({ type: z.literal("text"), text: z.string() }))
    .parse(result.content);
  return JSON.parse(content.map((item) => item.text).join("")) as unknown;
}

describe("installed Agentation MCP against the authenticated adapter", () => {
  let server: Awaited<ReturnType<typeof startAgentationContractServer>>;
  let closeServer: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    server = await startAgentationContractServer();
    closeServer = server.close;
  });
  afterAll(async () => {
    await closeServer?.();
  });

  const tool = (name: string, args: Record<string, unknown> = {}) =>
    callTool(server.client, name, args);
  async function fixture() {
    const author = server.actors[0];
    const sessionResponse = await server.request(
      "/agentation/sessions",
      author,
      "POST",
      {
        url: `http://localhost:3000/contract/${randomUUID()}?private=discard#fragment`,
      },
    );
    await expectHttpStatus(sessionResponse, 201);
    const session = agentationSessionResponseSchema.parse(
      await sessionResponse.json(),
    );
    expect(session.url).not.toContain("private");
    const input = {
      id: randomUUID(),
      x: 10,
      y: 20,
      comment: "Upstream test feedback",
      element: "button",
      elementPath: "main > button",
      timestamp: Date.now(),
    };
    const create = await server.request(
      `/agentation/sessions/${session.id}/annotations`,
      author,
      "POST",
      { ...input, authorId: server.actors[1]?.userId, status: "resolved" },
    );
    await expectHttpStatus(create, 201);
    const annotation = agentationAnnotationResponseSchema.parse(
      await create.json(),
    );
    expect(annotation).toMatchObject({
      status: "pending",
      authorId: author?.userId,
    });
    return { session, annotation, input, author };
  }

  function findMatchingEvent(frames: readonly string[], type: string) {
    for (const frame of frames) {
      const data = frame.split("\n").find((line) => line.startsWith("data: "));
      if (!data) continue;
      const event = agentationSseEventSchema.parse(
        JSON.parse(data.slice("data: ".length)),
      );
      if (event.type === type) return event;
    }
    return undefined;
  }

  async function nextEvent(
    sessionId: string,
    type: string,
    lastEventId?: string,
  ) {
    const response = await server.request(
      `/agentation/sessions/${sessionId}/events`,
      server.actors[0],
      "GET",
      undefined,
      {
        signal: AbortSignal.timeout(5000),
        headers: lastEventId ? { "last-event-id": lastEventId } : {},
      },
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-transform");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing SSE response body");
    const decoder = new TextDecoder();
    const state = { buffer: "" };
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("SSE ended without the expected event");
        state.buffer += decoder.decode(chunk.value, { stream: true });
        const frames = state.buffer.split("\n\n");
        state.buffer = frames.pop() ?? "";
        const event = findMatchingEvent(frames, type);
        if (event) return event;
      }
    } finally {
      await reader.cancel();
    }
  }

  it("exposes the nine required stock tools without a custom MCP implementation", async () => {
    const status = await server.request("/agentation/status", server.actors[0]);
    await expectHttpStatus(status, 200);
    expect(await status.json()).toMatchObject({
      mode: "postgres",
      webhooksConfigured: false,
      webhookCount: 0,
    });
    const { tools } = await server.client.listTools();
    expect(tools.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "agentation_list_sessions",
        "agentation_get_session",
        "agentation_get_pending",
        "agentation_get_all_pending",
        "agentation_acknowledge",
        "agentation_resolve",
        "agentation_dismiss",
        "agentation_reply",
        "agentation_watch_annotations",
      ]),
    );
  });

  it("supports stock reads, acknowledge, reply, resolve and dismiss", async () => {
    const { session, annotation } = await fixture();
    const sessions = await tool("agentation_list_sessions");
    expect(JSON.stringify(sessions)).toContain(session.id);
    expect(
      JSON.stringify(
        await tool("agentation_get_session", { sessionId: session.id }),
      ),
    ).toContain(annotation.id);
    expect(
      JSON.stringify(
        await tool("agentation_get_pending", { sessionId: session.id }),
      ),
    ).toContain(annotation.id);
    expect(JSON.stringify(await tool("agentation_get_all_pending"))).toContain(
      annotation.id,
    );
    await tool("agentation_acknowledge", { annotationId: annotation.id });
    await tool("agentation_reply", {
      annotationId: annotation.id,
      message: "Stock client reply",
    });
    await tool("agentation_resolve", {
      annotationId: annotation.id,
      summary: "Resolved by stock client",
    });
    await tool("agentation_dismiss", {
      annotationId: annotation.id,
      reason: "Dismissed by stock client",
    });
    const response = await server.request(
      `/agentation/annotations/${annotation.id}`,
      server.actors[0],
    );
    const updated = agentationAnnotationResponseSchema.parse(
      await response.json(),
    );
    expect(updated).toMatchObject({ status: "dismissed", resolvedBy: "agent" });
    expect(updated.thread.map((message) => message.role)).toEqual([
      "agent",
      "agent",
      "agent",
    ]);
    expect(JSON.stringify(updated.thread)).toContain("Stock client reply");
    expect(
      JSON.stringify(
        await tool("agentation_get_pending", { sessionId: session.id }),
      ),
    ).not.toContain(annotation.id);
  });

  it("delivers a new annotation to the stock watch tool over SSE", async () => {
    const { session, annotation, author, input } = await fixture();
    await tool("agentation_acknowledge", { annotationId: annotation.id });
    const watching = tool("agentation_watch_annotations", {
      sessionId: session.id,
      timeoutSeconds: 5,
      batchWindowSeconds: 0.1,
    });
    await vi.waitFor(() =>
      expect(getAgentationSseConnectionCounts().agentListeners).toBeGreaterThan(
        0,
      ),
    );
    const response = await server.request(
      `/agentation/sessions/${session.id}/annotations`,
      author,
      "POST",
      { ...input, id: randomUUID(), comment: "Created while watching" },
    );
    const created = agentationAnnotationResponseSchema.parse(
      await response.json(),
    );
    expect(JSON.stringify(await watching)).toContain(created.id);
  });

  it("recovers from an SSE timeout and replays one stock MCP update", async () => {
    const { session, annotation } = await fixture();
    const identity = await server.prisma.agentationAnnotation.findUnique({
      where: { id: annotation.id },
      select: {
        id: true,
        clientId: true,
        sessionId: true,
        authorUserId: true,
      },
    });
    const latest = await server.prisma.agentationEvent.aggregate({
      where: { sessionId: session.id },
      _max: { sequence: true },
    });
    const cursor = latest._max.sequence ?? BigInt(0);
    const listenerBaseline = getAgentationSseConnectionCounts().activeListeners;
    const timedOut = nextEvent(
      session.id,
      "event.withheld.for.timeout",
      String(cursor),
    );

    await vi.waitFor(() =>
      expect(
        getAgentationSseConnectionCounts().activeListeners,
      ).toBeGreaterThan(listenerBaseline),
    );
    await expect(timedOut).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.waitFor(() =>
      expect(getAgentationSseConnectionCounts().activeListeners).toBe(
        listenerBaseline,
      ),
    );

    await tool("agentation_acknowledge", { annotationId: annotation.id });
    const persistedEvents = await server.prisma.agentationEvent.findMany({
      where: {
        sessionId: session.id,
        annotationId: annotation.id,
        type: "annotation.updated",
        sequence: { gt: cursor },
      },
    });
    expect(persistedEvents).toHaveLength(1);

    const replay = await nextEvent(
      session.id,
      "annotation.updated",
      String(cursor),
    );
    expect(replay).toMatchObject({
      sequence: Number(persistedEvents[0]?.sequence),
      payload: { id: annotation.id, status: "acknowledged" },
    });
    expect(
      await server.prisma.agentationAnnotation.findUnique({
        where: { id: annotation.id },
        select: {
          id: true,
          clientId: true,
          sessionId: true,
          authorUserId: true,
        },
      }),
    ).toEqual(identity);
    await vi.waitFor(() =>
      expect(getAgentationSseConnectionCounts().activeListeners).toBe(
        listenerBaseline,
      ),
    );
  }, 15_000);

  it("retains ownership, non-destructive toolbar delete and admin-only hard deletion", async () => {
    const { session, annotation, input, author } = await fixture();
    expect(
      (await server.request(`/agentation/annotations/${annotation.id}`)).status,
    ).toBe(401);
    expect(
      (
        await server.request(
          `/agentation/annotations/${annotation.id}`,
          server.actors[1],
        )
      ).status,
    ).toBe(404);
    const inboxPath = `/feedback/agentation_${annotation.id}`;
    expect((await server.request(inboxPath, author, "DELETE")).status).toBe(
      404,
    );
    expect(
      (
        await server.request(
          `/agentation/annotations/${annotation.id}`,
          author,
          "PATCH",
          { comment: "Edited through public HTTP" },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await server.request(
          `/agentation/annotations/${annotation.id}`,
          author,
          "DELETE",
        )
      ).status,
    ).toBe(200);
    expect(
      await server.prisma.agentationAnnotation.findUnique({
        where: { id: annotation.id },
      }),
    ).toMatchObject({ status: "dismissed" });
    expect(
      (await server.request(inboxPath, server.actors[2], "DELETE")).status,
    ).toBe(204);
    for (const id of [input.id, annotation.id]) {
      const replay = await server.request(
        `/agentation/sessions/${session.id}/annotations`,
        author,
        "POST",
        { ...input, id },
      );
      expect(
        agentationAnnotationResponseSchema.parse(await replay.json()).status,
      ).toBe("dismissed");
    }
    expect(
      await server.prisma.agentationAnnotation.findUnique({
        where: { id: annotation.id },
      }),
    ).toBeNull();
  });

  it("replays public action/update events and initial content-free deletions over HTTP", async () => {
    const { session, annotation, author } = await fixture();
    const latest = await server.prisma.agentationEvent.aggregate({
      where: { sessionId: session.id },
      _max: { sequence: true },
    });
    const cursor = String(latest._max.sequence);
    const action = await server.request(
      `/agentation/sessions/${session.id}/action`,
      author,
      "POST",
      { output: "Handle these annotations" },
    );
    await expectHttpStatus(action, 200);
    expect(
      (await nextEvent(session.id, "action.requested", cursor)).payload,
    ).toMatchObject({
      sessionId: session.id,
      output: "Handle these annotations",
    });
    await server.request(
      `/agentation/annotations/${annotation.id}`,
      author,
      "PATCH",
      { comment: "Updated before reconnect" },
    );
    expect(
      (await nextEvent(session.id, "annotation.updated", cursor)).payload,
    ).toMatchObject({ id: annotation.id, comment: "Updated before reconnect" });
    await server.request(
      `/feedback/agentation_${annotation.id}`,
      server.actors[2],
      "DELETE",
    );
    const deleted = await nextEvent(session.id, "annotation.updated");
    expect(deleted.payload).toMatchObject({
      id: annotation.id,
      deleted: true,
      status: "dismissed",
    });
    expect(deleted.payload).not.toHaveProperty("comment");
  }, 15_000);
});

describe("Agentation contract fixture failure cleanup", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await disconnectTestPrisma();
  });

  it("preserves startup and close failures after releasing real resources", async () => {
    const startupFailure = new Error("injected post-connect startup failure");
    const closeFailure = new Error("injected post-close failure");
    const listenerClose = vi.spyOn(HttpServer.prototype, "close");
    const transportClose = vi.spyOn(StdioClientTransport.prototype, "close");
    const poolEnd = vi.spyOn(pg.Pool.prototype, "end");
    const prisma = createTestPrisma();
    const fixtureUsersBefore = await prisma.user.count({
      where: { name: "Upstream contract" },
    });
    const prismaDisconnect = vi.spyOn(prisma, "$disconnect");

    const connect = vi.spyOn(Client.prototype, "connect");
    connect.mockImplementationOnce(async function (
      this: Client,
      transport,
      options,
    ) {
      connect.mockRestore();
      await this.connect(transport, options);
      throw startupFailure;
    });
    vi.spyOn(Client.prototype, "close").mockRejectedValueOnce(closeFailure);

    const failure = await startAgentationContractServer().then(
      async (started) => {
        await started.close();
        return new Error("Expected contract fixture startup to fail");
      },
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(AggregateError);
    const errors: unknown[] = (failure as AggregateError).errors;
    expect(errors).toHaveLength(2);
    expect((errors[0] as Error).cause).toBe(startupFailure);
    expect(errors[1]).toBe(closeFailure);
    expect(transportClose).toHaveBeenCalledOnce();
    expect(
      (transportClose.mock.contexts[0] as StdioClientTransport).pid,
    ).toBeNull();
    expect(listenerClose).toHaveBeenCalledOnce();
    expect((listenerClose.mock.contexts[0] as HttpServer).listening).toBe(
      false,
    );
    expect(prismaDisconnect).toHaveBeenCalledOnce();
    expect(poolEnd).toHaveBeenCalledOnce();

    const verificationPrisma = createTestPrisma();
    expect(
      await verificationPrisma.user.count({
        where: { name: "Upstream contract" },
      }),
    ).toBe(fixtureUsersBefore);
  });
});

// Separate fixture: the earlier describe's close() deletes its own actors'
// sessions (cascading annotations), so this suite starts with no leftover
// pending rows and the stock watch cannot drain them instead of opening SSE.
describe("installed Agentation MCP all-session watch", () => {
  let server: Awaited<ReturnType<typeof startAgentationContractServer>>;
  let closeServer: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    server = await startAgentationContractServer();
    closeServer = server.close;
  });
  afterAll(async () => {
    await closeServer?.();
  });

  const tool = (name: string, args: Record<string, unknown> = {}) =>
    callTool(server.client, name, args);

  it("delivers a new annotation to the all-session stock watch tool over SSE", async () => {
    // The stock watch tool drains GET /pending before opening SSE; the API key
    // is admin-scoped and sees every project pending row, so a leftover row
    // would answer the watch without ever reaching /events?agent=true.
    expect(await tool("agentation_get_all_pending")).toMatchObject({
      count: 0,
      annotations: [],
    });
    const author = server.actors[0];
    const sessionResponse = await server.request(
      "/agentation/sessions",
      author,
      "POST",
      { url: `http://localhost:3000/contract/${randomUUID()}` },
    );
    await expectHttpStatus(sessionResponse, 201);
    const session = agentationSessionResponseSchema.parse(
      await sessionResponse.json(),
    );
    const agentBaseline = getAgentationSseConnectionCounts().agentListeners;
    const watching = tool("agentation_watch_annotations", {
      timeoutSeconds: 5,
      batchWindowSeconds: 0.1,
    });
    await vi.waitFor(() =>
      expect(getAgentationSseConnectionCounts().agentListeners).toBeGreaterThan(
        agentBaseline,
      ),
    );
    const create = await server.request(
      `/agentation/sessions/${session.id}/annotations`,
      author,
      "POST",
      {
        id: randomUUID(),
        x: 10,
        y: 20,
        comment: "Created while watching all sessions",
        element: "button",
        elementPath: "main > button",
        timestamp: Date.now(),
      },
    );
    await expectHttpStatus(create, 201);
    const created = agentationAnnotationResponseSchema.parse(
      await create.json(),
    );
    const result = await watching;
    expect(JSON.stringify(result)).toContain(created.id);
    expect(JSON.stringify(result)).toContain(session.id);
  }, 15_000);
});
