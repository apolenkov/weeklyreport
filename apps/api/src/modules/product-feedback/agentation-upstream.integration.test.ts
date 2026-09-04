import { randomUUID } from "node:crypto";

import {
  agentationAnnotationResponseSchema,
  agentationSessionResponseSchema,
  agentationSseEventSchema,
} from "@customreport/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { startAgentationContractServer } from "../../test-utils/agentation-contract-server";
import { getAgentationSseConnectionCounts } from "./agentation-sse";

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

  async function tool(name: string, args: Record<string, unknown> = {}) {
    const result = await server.client.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    const content = z
      .array(z.object({ type: z.literal("text"), text: z.string() }))
      .parse(result.content);
    return JSON.parse(content.map((item) => item.text).join("")) as unknown;
  }
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
    expect(sessionResponse.status).toBe(201);
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
    expect(create.status).toBe(201);
    const annotation = agentationAnnotationResponseSchema.parse(
      await create.json(),
    );
    expect(annotation).toMatchObject({
      status: "pending",
      authorId: author?.userId,
    });
    return { session, annotation, input, author };
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
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!data) continue;
          const event = agentationSseEventSchema.parse(
            JSON.parse(data.slice("data: ".length)),
          );
          if (event.type === type) return event;
        }
      }
    } finally {
      await reader.cancel();
    }
  }

  it("exposes the nine required stock tools without a custom MCP implementation", async () => {
    const status = await server.request("/agentation/status", server.actors[0]);
    expect(status.status).toBe(200);
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
    expect(action.status).toBe(200);
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
  });
});
