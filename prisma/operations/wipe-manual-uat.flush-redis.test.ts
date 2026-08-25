import net from "node:net";

import { describe, expect, it, vi } from "vitest";

const pgMock = vi.hoisted(() => ({ Pool: vi.fn() }));
vi.mock("pg", () => ({ default: pgMock }));

import {
  registerMockRedisTeardown,
  settlePromptly,
  startMockRedisServer,
} from "../guards/_mock-redis-server.js";

async function loadWipeManualUat(): Promise<
  typeof import("./wipe-manual-uat.js")
> {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:test@127.0.0.1:5432/customreport_e2e",
  );
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  return import("./wipe-manual-uat.js");
}

function configureRedis(port: number): void {
  vi.stubEnv("MANUAL_UAT_WIPE_FLUSH_REDIS", "true");
  vi.stubEnv("REDIS_HOST", "127.0.0.1");
  vi.stubEnv("REDIS_PORT", String(port));
}

registerMockRedisTeardown();

describe("flushRedisDb", () => {
  it("rejects an unsafe database before opening the Redis socket", async () => {
    let connections = 0;
    const server = net.createServer(() => {
      connections += 1;
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (address === null || typeof address === "string") {
      server.close();
      throw new Error("Expected a TCP test server address");
    }
    configureRedis(address.port);
    const { flushRedisDb } = await loadWipeManualUat();
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@127.0.0.1:5432/customreport_dev",
    );
    try {
      await expect(flushRedisDb()).rejects.toThrow(/not one of/u);
      expect(connections).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects an unsafe database before constructing a Prisma pool", async () => {
    const { runWipeManualUat } = await loadWipeManualUat();
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@127.0.0.1:5432/customreport_dev",
    );

    await expect(runWipeManualUat()).rejects.toThrow(/not one of/u);
    expect(pgMock.Pool).not.toHaveBeenCalled();
  });

  it("resolves success after an observed +OK reply", async () => {
    const server = await startMockRedisServer("+OK\r\n");
    configureRedis(server.port);
    const { flushRedisDb } = await loadWipeManualUat();

    await expect(flushRedisDb()).resolves.toEqual({ flushed: true });
  });

  it("resolves a replyless close promptly as an explicit failure", async () => {
    const server = await startMockRedisServer(undefined);
    configureRedis(server.port);
    const { flushRedisDb } = await loadWipeManualUat();

    await expect(settlePromptly(flushRedisDb())).resolves.toEqual({
      flushed: false,
      reason: "closed-before-reply",
    });
  });

  it("resolves a socket error as an explicit failure", async () => {
    const server = await startMockRedisServer(undefined);
    const closedPort = server.port;
    await server.close();
    configureRedis(closedPort);
    const { flushRedisDb } = await loadWipeManualUat();

    const result = await settlePromptly(flushRedisDb());
    expect(result.flushed).toBe(false);
    if (result.flushed) throw new Error("expected a failed flush");
    expect(result.reason).toContain("ECONNREFUSED");
  });
});

describe("assertRedisFlushOutcome (entrypoint boundary)", () => {
  it("accepts a successful flush", async () => {
    const { assertRedisFlushOutcome } = await loadWipeManualUat();
    expect(() => assertRedisFlushOutcome({ flushed: true })).not.toThrow();
  });

  it("accepts the explicit disabled-by-env opt-out", async () => {
    const { assertRedisFlushOutcome } = await loadWipeManualUat();
    expect(() =>
      assertRedisFlushOutcome({ flushed: false, reason: "disabled-by-env" }),
    ).not.toThrow();
  });

  it.each([
    "invalid-redis-port",
    "timeout",
    "closed-before-reply",
    "ECONNREFUSED",
  ])("rejects a non-disabled flush failure (%s)", async (reason) => {
    const { assertRedisFlushOutcome } = await loadWipeManualUat();
    expect(() => assertRedisFlushOutcome({ flushed: false, reason })).toThrow(
      /Redis FLUSHDB failed after reseed/,
    );
  });
});
