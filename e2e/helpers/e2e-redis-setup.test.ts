import net from "node:net";

import { describe, expect, it } from "vitest";

import {
  e2eRedisResetTarget,
  E2eRedisSetupError,
  flushE2eRedis,
} from "./e2e-redis-setup.js";

describe("E2E Redis reset guard", () => {
  it("requires an explicit flush for every runtime campaign", () => {
    expect(() =>
      e2eRedisResetTarget({ RUNTIME_SWEEP_ARCHIVE: "/archive/r35" }),
    ).toThrow(E2eRedisSetupError);
  });

  it("rejects non-loopback targets before opening a connection", () => {
    expect(() =>
      e2eRedisResetTarget({
        E2E_REDIS_FLUSH: "true",
        REDIS_HOST: "redis.example.com",
        REDIS_PORT: "6379",
      }),
    ).toThrow(/loopback/iu);
  });

  it("keeps ordinary integration runs non-mutating by default", () => {
    expect(e2eRedisResetTarget({})).toBeNull();
  });
});

describe("E2E Redis reset command", () => {
  it("sends one FLUSHDB command and requires an OK reply", async () => {
    const received = Promise.withResolvers<string>();
    const server = net.createServer((socket) => {
      socket.once("data", (chunk) => {
        received.resolve(chunk.toString("utf8"));
        socket.end("+OK\r\n");
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (typeof address === "string" || address === null) {
      server.close();
      throw new Error("Expected a TCP test server address");
    }

    try {
      await expect(
        flushE2eRedis(
          { host: "127.0.0.1", port: address.port },
          {
            E2E_DATABASE_URL:
              "postgresql://user:pass@127.0.0.1:5432/customreport_e2e",
            NODE_ENV: "test",
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
          },
        ),
      ).resolves.toBeUndefined();
      await expect(received.promise).resolves.toBe("*1\r\n$7\r\nFLUSHDB\r\n");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects the database target before opening a Redis connection", async () => {
    const server = net.createServer(() => {
      throw new Error("Redis connection must not be attempted");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (typeof address === "string" || address === null) {
      server.close();
      throw new Error("Expected a TCP test server address");
    }

    try {
      expect(() =>
        flushE2eRedis(
          { host: "127.0.0.1", port: address.port },
          {
            E2E_DATABASE_URL:
              "postgresql://user:pass@127.0.0.1:5432/customreport_dev",
            NODE_ENV: "test",
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
          },
        ),
      ).toThrow(/not one of/u);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
