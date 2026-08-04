import { describe, expect, it, vi } from "vitest";

import {
  registerMockRedisTeardown,
  settlePromptly,
  startMockRedisServer,
} from "./_mock-redis-server.js";
import { assertRedisFlushOutcome, flushRedisDb } from "./wipe-manual-uat.js";

function configureRedis(port: number): void {
  vi.stubEnv("MANUAL_UAT_WIPE_FLUSH_REDIS", "true");
  vi.stubEnv("REDIS_HOST", "127.0.0.1");
  vi.stubEnv("REDIS_PORT", String(port));
}

registerMockRedisTeardown();

describe("flushRedisDb", () => {
  it("resolves success after an observed +OK reply", async () => {
    const server = await startMockRedisServer("+OK\r\n");
    configureRedis(server.port);

    await expect(flushRedisDb()).resolves.toEqual({ flushed: true });
  });

  it("resolves a replyless close promptly as an explicit failure", async () => {
    const server = await startMockRedisServer(undefined);
    configureRedis(server.port);

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

    const result = await settlePromptly(flushRedisDb());
    expect(result.flushed).toBe(false);
    if (result.flushed) throw new Error("expected a failed flush");
    expect(result.reason).toContain("ECONNREFUSED");
  });
});

describe("assertRedisFlushOutcome (entrypoint boundary)", () => {
  it("accepts a successful flush", () => {
    expect(() => assertRedisFlushOutcome({ flushed: true })).not.toThrow();
  });

  it("accepts the explicit disabled-by-env opt-out", () => {
    expect(() =>
      assertRedisFlushOutcome({ flushed: false, reason: "disabled-by-env" }),
    ).not.toThrow();
  });

  it.each([
    "invalid-redis-port",
    "timeout",
    "closed-before-reply",
    "ECONNREFUSED",
  ])("rejects a non-disabled flush failure (%s)", (reason) => {
    expect(() => assertRedisFlushOutcome({ flushed: false, reason })).toThrow(
      /Redis FLUSHDB failed after reseed/,
    );
  });
});
