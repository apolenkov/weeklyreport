import type { Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { Redis } from "ioredis";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { assertE2eRuntimeDestructiveTarget } from "../../../../../prisma/guards/_destructive-guard.js";
import { requireEnv } from "../../lib/env";
import { createNullLogger } from "../../lib/logger";
import type { EnvConfig } from "../config/env.schema";
import { createRateLimits } from "./rate-limit.middleware";

// The limiter only logs on a 429; a no-op warn sink is all these servers need.
const silentLogger = createNullLogger();

// A partial EnvConfig carrying only the fields the rate-limit store reads.
const REDIS_ENV: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT"> = {
  REDIS_DB: Number(requireEnv(process.env, "REDIS_DB")),
  REDIS_HOST: requireEnv(process.env, "REDIS_HOST"),
  REDIS_PORT: Number(requireEnv(process.env, "REDIS_PORT")),
};
const REDIS_OPTIONS = {
  db: REDIS_ENV.REDIS_DB,
  host: REDIS_ENV.REDIS_HOST,
  port: REDIS_ENV.REDIS_PORT,
  maxRetriesPerRequest: 1,
} as const;
const SCRIPT_NAME = "rate-limit-redis-store.integration";

function assertSafeRedisMutation(): void {
  assertE2eRuntimeDestructiveTarget(
    SCRIPT_NAME,
    requireEnv(process.env, "E2E_DATABASE_URL"),
    process.env,
  );
  if (REDIS_ENV.REDIS_DB !== 15) {
    throw new Error(
      `[${SCRIPT_NAME}] REDIS_DB must be exactly 15 before Redis access.`,
    );
  }
}

// Documentation IP (RFC 5737) so the keyed bucket never collides with a real
// client. `trust proxy: 1` makes X-Forwarded-For the resolved req.ip.
const CLIENT_IP = "198.51.100.77";
const AUTH_KEY = `rl:auth:${CLIENT_IP}`;
const TRPC_KEY = `rl:trpc:${CLIENT_IP}`;
const AUTH_BUDGET = 5;

// Each factory instance gets its own injected client so the test owns every
// connection's lifecycle (no leaked ioredis sockets keeping vitest alive).
const clients: Redis[] = [];
function ownedClient(): Redis {
  assertSafeRedisMutation();
  const client = new Redis(REDIS_OPTIONS);
  clients.push(client);
  return client;
}

assertSafeRedisMutation();
const admin = new Redis(REDIS_OPTIONS);

beforeEach(async () => {
  assertSafeRedisMutation();
  await admin.del(AUTH_KEY, TRPC_KEY);
});

afterAll(async () => {
  assertSafeRedisMutation();
  await admin.del(AUTH_KEY, TRPC_KEY);
  await admin.quit();
  await Promise.all(clients.map((client) => client.quit()));
});

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

function get(port: number, path: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const clientReq = request(
      {
        host: "127.0.0.1",
        port,
        path,
        headers: { "X-Forwarded-For": CLIENT_IP },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve(res.statusCode ?? 0);
        });
      },
    );
    clientReq.on("error", reject);
    clientReq.end();
  });
}

// Boots a fresh Express app whose /auth and /trpc handlers are guarded by a
// Redis-backed limiter built from an owned client — one app per "process".
async function buildApp(): Promise<express.Express> {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const { authLimiter, trpcLimiter } = await createRateLimits({
    logger: silentLogger,
    isTest: false,
    redis: ownedClient(),
  });
  app.use("/auth", authLimiter, (_req, res) => {
    res.sendStatus(200);
  });
  app.use("/trpc", trpcLimiter, (_req, res) => {
    res.sendStatus(200);
  });
  return app;
}

describe("rate-limit Redis store — restart survival", () => {
  it("keeps the auth window across a fresh factory (simulated restart)", async () => {
    const first = await listen(await buildApp());
    const firstPort = (first.address() as AddressInfo).port;
    try {
      const statuses: number[] = [];
      for (let i = 0; i < AUTH_BUDGET + 1; i += 1) {
        statuses.push(await get(firstPort, "/auth"));
      }
      expect(statuses.slice(0, AUTH_BUDGET).every((s) => s === 200)).toBe(true);
      expect(statuses[AUTH_BUDGET]).toBe(429);
    } finally {
      await close(first);
    }

    // A second factory with a brand-new client stands in for a restarted
    // process. MemoryStore would reset the window to zero here; the Redis
    // store retains the count, so the very next request is still limited.
    const second = await listen(await buildApp());
    const secondPort = (second.address() as AddressInfo).port;
    try {
      expect(await get(secondPort, "/auth")).toBe(429);
    } finally {
      await close(second);
    }
  });
});

describe("rate-limit Redis store — per-bucket isolation", () => {
  it("does not let the auth bucket bleed into the trpc bucket", async () => {
    const server = await listen(await buildApp());
    const { port } = server.address() as AddressInfo;
    try {
      // Exhaust the auth bucket for this IP.
      for (let i = 0; i < AUTH_BUDGET + 1; i += 1) {
        await get(port, "/auth");
      }
      expect(await get(port, "/auth")).toBe(429);
      // The trpc bucket carries a distinct `rl:trpc:` prefix, so the same IP is
      // untouched there — a shared prefix would have already tripped it.
      expect(await get(port, "/trpc")).toBe(200);
    } finally {
      await close(server);
    }
  });
});
