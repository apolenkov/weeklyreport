import { describe, expect, it, vi } from "vitest";

import {
  registerMockRedisTeardown,
  settlePromptly,
  startMockRedisServer,
} from "./_mock-redis-server.js";

// Loads the reset script without depending on a developer database setting.
async function loadFlushRedis(): Promise<
  typeof import("./reset-hard.js").flushRedis
> {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:test@127.0.0.1:5432/customreport_test",
  );
  const { flushRedis } = await import("./reset-hard.js");
  return flushRedis;
}

function configureRedis(port: number): void {
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("REDIS_HOST", "127.0.0.1");
  vi.stubEnv("REDIS_PORT", String(port));
}

registerMockRedisTeardown();

describe("flushRedis", () => {
  it("resolves after an observed +OK reply", async () => {
    const server = await startMockRedisServer("+OK\r\n");
    configureRedis(server.port);
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).resolves.toBeUndefined();
  });

  it("rejects a replyless close promptly", async () => {
    const server = await startMockRedisServer(undefined);
    configureRedis(server.port);
    const flushRedis = await loadFlushRedis();

    await expect(settlePromptly(flushRedis())).rejects.toThrow(
      "Redis FLUSHALL: connection closed before +OK was received",
    );
  });

  it("rejects a socket error", async () => {
    const server = await startMockRedisServer(undefined);
    const closedPort = server.port;
    await server.close();
    configureRedis(closedPort);
    const flushRedis = await loadFlushRedis();

    await expect(settlePromptly(flushRedis())).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });
  });
});
