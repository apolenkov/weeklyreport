import type { Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";

import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AppLogger } from "../../lib/logger";
import { createRateLimits } from "../throttler/rate-limit.middleware";
import { TRPC_MAX_BODY_BYTES } from "./ingress-limits";

// The composed mounts below never log unless a 429 fires, and these servers key
// per loopback IP, so a no-op warn sink is all the limiter needs.
const silentLogger = { warn: () => undefined } as unknown as AppLogger;

interface HttpResponse {
  status: number;
  body: string;
}

async function listen(app: express.Express): Promise<Server> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      resolve();
    });
  });
  return server;
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

function postJson(
  port: number,
  path: string,
  bodyStr: string,
): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const clientReq = request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
          });
        });
      },
    );
    clientReq.on("error", reject);
    clientReq.write(bodyStr);
    clientReq.end();
  });
}

async function floodPost(
  port: number,
  path: string,
  bodyStr: string,
  count: number,
): Promise<HttpResponse[]> {
  const responses: HttpResponse[] = [];
  for (let i = 0; i < count; i += 1) {
    responses.push(await postJson(port, path, bodyStr));
  }
  return responses;
}

function buildClientLogsApp(): express.Express {
  // Mirror the main.ts mount order: limiter → json parser → handler, so the
  // limiter guards the log-writing handler ahead of the parse.
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const { clientLogsLimiter } = createRateLimits({
    logger: silentLogger,
    isTest: false,
  });
  app.use(
    "/api/client-logs",
    clientLogsLimiter,
    express.json({ limit: "128kb" }),
    (_req, res) => {
      res.sendStatus(204);
    },
  );
  return app;
}

describe("public ingress limits — /api/client-logs flood", () => {
  it("accepts traffic under the limit and returns 429 over it", async () => {
    // Production budget (isTest=false) is 60/min/IP; fire one past it.
    const server = await listen(buildClientLogsApp());
    const { port } = server.address() as AddressInfo;

    try {
      const responses = await floodPost(
        port,
        "/api/client-logs",
        JSON.stringify({ entries: [] }),
        61,
      );
      expect(responses.slice(0, 60).every((r) => r.status === 204)).toBe(true);
      expect(responses[60].status).toBe(429);
      const rejected = JSON.parse(responses[60].body) as { error: string };
      expect(rejected.error).toBe("rate_limit_exceeded");
    } finally {
      await close(server);
    }
  });
});

const t = initTRPC.create();
const probeRouter = t.router({
  echo: t.procedure
    .input(z.object({ value: z.string() }))
    .mutation(({ input }) => ({ ok: input.value })),
});

function buildTrpcApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: probeRouter,
      maxBodySize: TRPC_MAX_BODY_BYTES,
    }),
  );
  return app;
}

describe("public ingress limits — tRPC body cap", () => {
  it("rejects a mutation body over the configured limit with 413", async () => {
    const server = await listen(buildTrpcApp());
    const { port } = server.address() as AddressInfo;
    const oversized = JSON.stringify({
      value: "x".repeat(TRPC_MAX_BODY_BYTES),
    });

    try {
      const res = await postJson(port, "/trpc/echo", oversized);
      expect(res.status).toBe(413);
      expect(res.body).toContain("PAYLOAD_TOO_LARGE");
    } finally {
      await close(server);
    }
  });

  it("executes a mutation whose body is within the limit", async () => {
    const server = await listen(buildTrpcApp());
    const { port } = server.address() as AddressInfo;

    try {
      const res = await postJson(
        port,
        "/trpc/echo",
        JSON.stringify({ value: "hi" }),
      );
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body) as {
        result: { data: { ok: string } };
      };
      expect(parsed.result.data.ok).toBe("hi");
    } finally {
      await close(server);
    }
  });
});
