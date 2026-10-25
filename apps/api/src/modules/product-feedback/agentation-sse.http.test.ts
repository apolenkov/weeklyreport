import type { AddressInfo } from "node:net";

import express from "express";
import { expect, it } from "vitest";

import { startAgentationSse } from "./agentation-sse";

it("keeps polling after the GET request has finished while its response stays open", async () => {
  const app = express();
  app.disable("x-powered-by");
  const state = { published: false };
  app.get("/events", async (req, res) => {
    await startAgentationSse({
      req,
      res,
      scopedSessionId: "s-1",
      agent: false,
      allowGlobal: false,
      pollIntervalMs: 10,
      source: {
        loadLatestSequence: () => Promise.resolve(0n),
        loadDeletionEvents: () => Promise.resolve([]),
        loadPending: () => Promise.resolve([]),
        loadEvents: () =>
          Promise.resolve(
            state.published
              ? [
                  {
                    sequence: 1n,
                    type: "annotation.updated",
                    timestamp: new Date().toISOString(),
                    payload: { id: "a-1", status: "dismissed" },
                  },
                ]
              : [],
          ),
      },
    });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 2000);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/events`, {
      signal: controller.signal,
    });
    state.published = true;
    const reader: ReadableStreamDefaultReader<Uint8Array> | undefined =
      response.body?.getReader();
    expect(reader).toBeDefined();
    const first = await reader?.read();
    const opened = new TextDecoder().decode(first?.value);
    expect(opened).toContain(": connected");
    const chunk = opened.includes("annotation.updated")
      ? opened
      : new TextDecoder().decode((await reader?.read())?.value);
    expect(chunk).toContain("annotation.updated");
  } finally {
    clearTimeout(deadline);
    controller.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
