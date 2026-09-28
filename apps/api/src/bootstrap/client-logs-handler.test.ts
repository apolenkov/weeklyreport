import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../lib/logger";
import {
  createClientLogsHandler,
  parseClientLogEntry,
} from "./client-logs-handler";

const validEntry = {
  level: "error",
  message: "Request failed",
  source: "console",
  url: "https://customreport.test/lead/report",
  stack: "Error: Request failed",
  ts: 1_785_608_000_000,
} as const;

function createLogger(error = vi.fn()): AppLogger {
  const logger: AppLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error,
    child: () => logger,
  };
  return logger;
}

async function listen(app: express.Express): Promise<Server> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return server;
}

async function postClientLogs(
  server: Server,
  body?: string,
): Promise<Response> {
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/api/client-logs`, {
    method: "POST",
    ...(body === undefined
      ? {}
      : {
          body,
          headers: { "content-type": "application/json" },
        }),
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("parseClientLogEntry", () => {
  it("accepts the complete browser event contract", () => {
    expect(parseClientLogEntry(validEntry)).toEqual(validEntry);
  });

  it.each([
    ["structured timestamp", { ...validEntry, ts: { value: 1 } }],
    ["non-finite timestamp", { ...validEntry, ts: Number.POSITIVE_INFINITY }],
    ["oversized message", { ...validEntry, message: "x".repeat(2001) }],
    ["unknown field", { ...validEntry, credentials: "secret" }],
  ])("rejects %s", (_label, entry) => {
    expect(parseClientLogEntry(entry)).toBeNull();
  });
});

describe("client-logs handler boundary", () => {
  it.each([
    ["absent", undefined],
    ["null", JSON.stringify(null)],
    ["primitive", JSON.stringify("unexpected body")],
  ])("accepts %s bodies without logging", async (_label, body) => {
    const error = vi.fn();
    const app = express();
    // strict:false lets this boundary test exercise JSON primitives that the
    // production parser would otherwise reject before reaching the handler.
    app.use(express.json({ strict: false }));
    app.post(
      "/api/client-logs",
      createClientLogsHandler({ logger: createLogger(error), enabled: true }),
    );
    const server = await listen(app);

    try {
      const response = await postClientLogs(server, body);
      expect(response.status).toBe(204);
      expect(error).not.toHaveBeenCalled();
    } finally {
      await close(server);
    }
  });

  it("forwards valid entries at the Express handler boundary", async () => {
    const error = vi.fn();
    const app = express();
    app.use(express.json());
    app.post(
      "/api/client-logs",
      createClientLogsHandler({ logger: createLogger(error), enabled: true }),
    );
    const server = await listen(app);

    try {
      const response = await postClientLogs(
        server,
        JSON.stringify({ entries: [validEntry] }),
      );
      expect(response.status).toBe(204);
      expect(error).toHaveBeenCalledWith(
        "client: Request failed",
        expect.objectContaining({ phase: "web.client", source: "console" }),
      );
    } finally {
      await close(server);
    }
  });

  it("keeps the disabled fast path independent of body shape", async () => {
    const error = vi.fn();
    const app = express();
    app.use(express.json({ strict: false }));
    app.post(
      "/api/client-logs",
      createClientLogsHandler({ logger: createLogger(error), enabled: false }),
    );
    const server = await listen(app);

    try {
      const response = await postClientLogs(server, JSON.stringify(42));
      expect(response.status).toBe(204);
      expect(error).not.toHaveBeenCalled();
    } finally {
      await close(server);
    }
  });
});
