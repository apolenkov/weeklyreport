import { request } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import { createFakeRedisCall } from "../../test-utils/fake-redis-call";
import {
  rateLimitHitsTotal,
  rateLimitStoreErrorsTotal,
} from "../metrics/metrics.registry";
import {
  createRateLimits,
  isRateLimitRedisReply,
} from "./rate-limit.middleware";

// The limiter only logs on a 429; isTest raises every bucket to 1000/min, so
// these single-shot requests never reach the handler and a no-op warn is enough.
const silentLogger = createNullLogger();

// Boot a minimal Express app configured exactly like main.ts (`trust proxy: 1`),
// mount the real authLimiter, and echo req.ip — the value the limiter's
// keyGenerator keys on. Returns how Express resolved req.ip for the given headers.
async function resolveReqIp(headers: Record<string, string>): Promise<string> {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const { authLimiter } = await createRateLimits({
    logger: silentLogger,
    isTest: true,
  });
  app.use(authLimiter);
  app.get("/", (req, res) => {
    res.json({ ip: req.ip });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;

  try {
    return await new Promise<string>((resolve, reject) => {
      const clientReq = request(
        { host: "127.0.0.1", port, path: "/", headers },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });
          res.on("end", () => {
            const parsed = JSON.parse(Buffer.concat(chunks).toString()) as {
              ip: string;
            };
            resolve(parsed.ip);
          });
        },
      );
      clientReq.on("error", reject);
      clientReq.end();
    });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}

describe("rate-limit middleware — trust-proxy IP resolution", () => {
  it("resolves req.ip from X-Forwarded-For when trust proxy is set", async () => {
    expect(await resolveReqIp({ "X-Forwarded-For": "203.0.113.42" })).toBe(
      "203.0.113.42",
    );
  });

  it("falls back to the loopback socket address when no X-Forwarded-For is present", async () => {
    // Loopback may surface as IPv4 (127.0.0.1) or IPv4-mapped IPv6
    // (::ffff:127.0.0.1) depending on the dual-stack bind; either proves req.ip
    // fell back to the real socket peer rather than a fabricated value.
    expect(await resolveReqIp({})).toContain("127.0.0.1");
  });
});

// Read the rateLimitHitsTotal counter for one bucket; absent → 0.
async function bucketHits(bucket: string): Promise<number> {
  const metric = await rateLimitHitsTotal.get();
  const entry = metric.values.find((v) => v.labels.bucket === bucket);
  return entry?.value ?? 0;
}

function postStatus(port: number, path: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const clientReq = request(
      { host: "127.0.0.1", port, path, method: "POST" },
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

describe("rate-limit middleware — vitals limiter budget", () => {
  it("returns 429 over budget and increments the vitals bucket", async () => {
    // Production budget (isTest=false) is 60/min; one past it from a single
    // loopback client shares one keyGenerator bucket. The fake redis backs the
    // real RedisStore so the production budget runs without a live Redis.
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    const { vitalsLimiter } = await createRateLimits({
      logger: silentLogger,
      isTest: false,
      redis: createFakeRedisCall() as unknown as Redis,
    });
    app.use("/api/web-vitals", vitalsLimiter);
    app.post("/api/web-vitals", (_req, res) => {
      res.sendStatus(204);
    });

    const server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once("listening", () => {
        resolve();
      });
    });
    const { port } = server.address() as AddressInfo;

    const before = await bucketHits("vitals");
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 61; i += 1) {
        statuses.push(await postStatus(port, "/api/web-vitals"));
      }
      expect(statuses.slice(0, 60).every((s) => s === 204)).toBe(true);
      expect(statuses[60]).toBe(429);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }

    expect(await bucketHits("vitals")).toBeGreaterThan(before);
  });
});

describe("rate-limit middleware — client-logs limiter budget", () => {
  it("returns 429 over budget and increments the client-logs bucket", async () => {
    // Production budget (isTest=false) is 60/min; one past it from a single
    // loopback client shares one keyGenerator bucket. The fake redis backs the
    // real RedisStore so the production budget runs without a live Redis.
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    const { clientLogsLimiter } = await createRateLimits({
      logger: silentLogger,
      isTest: false,
      redis: createFakeRedisCall() as unknown as Redis,
    });
    app.use("/api/client-logs", clientLogsLimiter);
    app.post("/api/client-logs", (_req, res) => {
      res.sendStatus(204);
    });

    const server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once("listening", () => {
        resolve();
      });
    });
    const { port } = server.address() as AddressInfo;

    const before = await bucketHits("client-logs");
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 61; i += 1) {
        statuses.push(await postStatus(port, "/api/client-logs"));
      }
      expect(statuses.slice(0, 60).every((s) => s === 204)).toBe(true);
      expect(statuses[60]).toBe(429);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }

    expect(await bucketHits("client-logs")).toBeGreaterThan(before);
  });
});

describe("rate-limit middleware — fail-loud store policy", () => {
  it("awaits readiness for an owned client but not an injected client", async () => {
    const connect = vi.spyOn(Redis.prototype, "connect");
    const readiness = Promise.withResolvers<void>();
    connect.mockImplementation(function (this: Redis) {
      // The owned client must retain IORedis recovery after a post-start
      // disconnect; the process-level boot catch already exits on initial failure.
      expect(this.options.retryStrategy).toBeTypeOf("function");
      return readiness.promise;
    });
    const callsBeforeFactory = connect.mock.calls.length;

    try {
      const creation = createRateLimits({
        logger: silentLogger,
        isTest: false,
        env: { REDIS_DB: 15, REDIS_HOST: "redis.example.com", REDIS_PORT: 6379 },
      });
      const beforeReadiness = await Promise.race([
        creation.then(() => "created" as const),
        Promise.resolve("waiting" as const),
      ]);
      expect(beforeReadiness).toBe("waiting");

      readiness.resolve();
      await creation;
      const callsAfterOwnedFactory = connect.mock.calls.length;
      expect(callsAfterOwnedFactory).toBeGreaterThan(callsBeforeFactory);

      await createRateLimits({
        logger: silentLogger,
        isTest: false,
        redis: createFakeRedisCall() as unknown as Redis,
      });
      expect(connect).toHaveBeenCalledTimes(callsAfterOwnedFactory);
    } finally {
      connect.mockRestore();
    }
  });

  it("propagates an owned-client connection failure", async () => {
    const connect = vi
      .spyOn(Redis.prototype, "connect")
      .mockRejectedValue(new Error("redis unavailable"));
    const disconnect = vi.spyOn(Redis.prototype, "disconnect");

    try {
      await expect(
        createRateLimits({
          logger: silentLogger,
          isTest: false,
          env: {
            REDIS_DB: 15,
            REDIS_HOST: "redis.example.com",
            REDIS_PORT: 6379,
          },
        }),
      ).rejects.toThrow("redis unavailable");
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      connect.mockRestore();
      disconnect.mockRestore();
    }
  });

  it("closes an owned client exactly once and leaves an injected client untouched", async () => {
    const connect = vi
      .spyOn(Redis.prototype, "connect")
      .mockResolvedValue(undefined);
    const disconnect = vi.spyOn(Redis.prototype, "disconnect");

    try {
      const owned = await createRateLimits({
        logger: silentLogger,
        isTest: false,
        env: { REDIS_DB: 15, REDIS_HOST: "redis.example.com", REDIS_PORT: 6379 },
      });
      const disconnectsBeforeShutdown = disconnect.mock.calls.length;

      await owned.shutdownRateLimitStore();
      await owned.shutdownRateLimitStore();

      expect(disconnect).toHaveBeenCalledTimes(disconnectsBeforeShutdown + 1);

      const injected = await createRateLimits({
        logger: silentLogger,
        isTest: false,
        redis: createFakeRedisCall() as unknown as Redis,
      });
      await injected.shutdownRateLimitStore();

      expect(disconnect).toHaveBeenCalledTimes(disconnectsBeforeShutdown + 1);
    } finally {
      connect.mockRestore();
      disconnect.mockRestore();
    }
  });

  it("throws at creation when a non-test limiter has no Redis store", async () => {
    // An absent env (or injected client) in production must fail boot loud
    // instead of silently degrading to the per-process MemoryStore
    // express-rate-limit would otherwise default to.
    await expect(
      createRateLimits({ logger: silentLogger, isTest: false }),
    ).rejects.toThrow(/Redis store is required outside test mode/);
  });

  it("keeps MemoryStore in test mode without a Redis store", async () => {
    // Test mode is the sanctioned MemoryStore exception (unit suites run
    // without Redis); it must not trip the production fail-loud fence.
    const limiters = await createRateLimits({
      logger: silentLogger,
      isTest: true,
    });
    expect(limiters.authLimiter).toBeTypeOf("function");
  });

  it("enforces the auth budget locally while Redis is unavailable", async () => {
    const fake = createFakeRedisCall();
    const redis = {
      ...fake,
      call: vi
        .fn<typeof fake.call>()
        .mockRejectedValue(new Error("redis unavailable")),
    };
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    const { authLimiter } = await createRateLimits({
      logger: silentLogger,
      isTest: false,
      redis: redis as unknown as Redis,
    });
    app.use(authLimiter);
    app.post("/", (_req, res) => {
      res.sendStatus(204);
    });

    const server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });
    const { port } = server.address() as AddressInfo;

    try {
      const statuses = await Promise.all(
        Array.from({ length: 6 }, () => postStatus(port, "/")),
      );
      expect(statuses.filter((status) => status === 204)).toHaveLength(5);
      expect(statuses.filter((status) => status === 429)).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });

  it("logs at error level and increments a counter when the store client errors", async () => {
    // Local enforcement keeps ingress bounded, while the outage remains
    // observable through an error log and metric.
    const errorSpy = vi.fn<AppLogger["error"]>();
    const logger: AppLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: errorSpy,
      child: () => logger,
    };
    const fake = createFakeRedisCall();
    rateLimitStoreErrorsTotal.reset();
    await createRateLimits({
      logger,
      isTest: false,
      redis: fake as unknown as Redis,
    });

    fake.emit("error", new Error("redis unreachable"));

    expect(errorSpy).toHaveBeenCalledWith(
      "rate-limit Redis store error; using local enforcement",
      expect.objectContaining({ phase: "rate-limit" }),
    );
    const snapshot = await rateLimitStoreErrorsTotal.get();
    const incremented = snapshot.values.reduce(
      (sum, entry) => sum + entry.value,
      0,
    );
    expect(incremented).toBe(1);
  });

  it("rejects a malformed Redis reply instead of asserting its shape", () => {
    // Redis primitives and primitive arrays are valid; object shapes fail.
    expect(isRateLimitRedisReply(42)).toBe(true);
    expect(isRateLimitRedisReply("PONG")).toBe(true);
    expect(isRateLimitRedisReply([1, "two", true])).toBe(true);
    expect(isRateLimitRedisReply({ unexpected: true })).toBe(false);
    expect(isRateLimitRedisReply([{ unexpected: true }])).toBe(false);
  });
});
