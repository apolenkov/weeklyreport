import net from "node:net";

import { describe, expect, it } from "vitest";

import { e2eRedisResetTarget, flushE2eRedis } from "./e2e-redis-setup.js";

describe("E2E Redis reset guard", () => {
  it("rejects non-loopback targets before opening a connection", () => {
    expect(() =>
      e2eRedisResetTarget({
        E2E_REDIS_FLUSH: "true",
        REDIS_DB: "15",
        REDIS_HOST: "redis.example.com",
        REDIS_PORT: "6379",
      }),
    ).toThrow(/loopback/iu);
  });

  it("keeps ordinary integration runs non-mutating by default", () => {
    expect(e2eRedisResetTarget({})).toBeNull();
  });

  it("rejects the ordinary developer Redis logical database", () => {
    expect(() =>
      e2eRedisResetTarget({
        E2E_REDIS_FLUSH: "true",
        REDIS_DB: "0",
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: "6379",
      }),
    ).toThrow(/reserved logical database 15/iu);
  });
});

describe("E2E Redis reset command", () => {
  it("selects reserved DB 15 before FLUSHDB and requires OK replies", async () => {
    const received = Promise.withResolvers<string>();
    const chunks: string[] = [];
    const server = net.createServer((socket) => {
      socket.on("data", (chunk) => {
        const command = chunk.toString("utf8");
        chunks.push(command);
        if (command.includes("SELECT")) {
          socket.write("+OK\r\n");
        } else {
          received.resolve(chunks.join(""));
          socket.end("+OK\r\n");
        }
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
          { database: 15, host: "127.0.0.1", port: address.port },
          {
            E2E_DATABASE_URL:
              "postgresql://user:pass@127.0.0.1:5432/customreport_e2e",
            NODE_ENV: "test",
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
            REDIS_DB: "15",
          },
        ),
      ).resolves.toBeUndefined();
      await expect(received.promise).resolves.toBe(
        "*2\r\n$6\r\nSELECT\r\n$2\r\n15\r\n*1\r\n$7\r\nFLUSHDB\r\n",
      );
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
          { database: 15, host: "127.0.0.1", port: address.port },
          {
            E2E_DATABASE_URL:
              "postgresql://user:pass@127.0.0.1:5432/customreport_dev",
            NODE_ENV: "test",
            PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
            REDIS_DB: "15",
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
