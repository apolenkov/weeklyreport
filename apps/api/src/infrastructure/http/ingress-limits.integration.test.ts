import type { Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";

import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createNullLogger } from "../../lib/logger";
import { createFakeRedisCall } from "../../test-utils/fake-redis-call";
import { createRateLimits } from "../throttler/rate-limit.middleware";
import {
  CLIENT_LOGS_JSON_LIMIT,
  mountClientLogsIngress,
  TRPC_MAX_BODY_BYTES,
} from "./ingress-limits";

// The composed mounts below never log unless a 429 fires, and these servers key
// per loopback IP, so a no-op warn sink is all the limiter needs.
const silentLogger = createNullLogger();

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

async function buildClientLogsApp(): Promise<express.Express> {
  // Mirror main.ts via mountClientLogsIngress so limiter→parser→handler order
  // and the byte limit cannot drift here without failing in production too.
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // The production-budget path requires a store; fake Redis exercises the real
  // RedisStore without an external service.
  const { clientLogsLimiter } = await createRateLimits({
    logger: silentLogger,
    isTest: false,
    redis: createFakeRedisCall() as unknown as Redis,
  });
  mountClientLogsIngress(
    app,
    "/api/client-logs",
    clientLogsLimiter,
    express.json({ limit: CLIENT_LOGS_JSON_LIMIT }),
    (_req, res) => {
      res.sendStatus(204);
    },
  );
  return app;
}

describe("public ingress limits — /api/client-logs flood", () => {
  it("accepts traffic under the limit and returns 429 over it", async () => {
    // Production budget (isTest=false) is 60/min/IP; fire one past it.
    const server = await listen(await buildClientLogsApp());
    const { port } = server.address() as AddressInfo;

    try {
      const responses = await floodPost(
        port,
        "/api/client-logs",
        JSON.stringify({ entries: [] }),
        61,
      );
      expect(responses.slice(0, 60).every((r) => r.status === 204)).toBe(true);
      const limited = responses.at(60);
      if (!limited) throw new Error("61st response missing");
      expect(limited.status).toBe(429);
      const rejected = JSON.parse(limited.body) as { error: string };
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
  it("pins the tRPC byte budget itself, not just its enforcement", () => {
    // repeat(TRPC_MAX_BODY_BYTES) always exceeds whatever the constant is,
    // so this literal pin is what catches a budget regression (10 bytes or
    // 10 GiB would both pass the oversize test below without it).
    expect(TRPC_MAX_BODY_BYTES).toBe(1024 * 1024);
  });

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
