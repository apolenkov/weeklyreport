import { describe, expect, it, vi } from "vitest";

import {
  registerMockRedisTeardown,
  settlePromptly,
  startMockRedisServer,
} from "../guards/_mock-redis-server.js";
import { quotePgIdentifier } from "./reset-hard.js";

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
  // FLUSHALL wipes every database on the server; the test endpoint is the
  // disposable mock server, so the explicit authorisation is granted.
  vi.stubEnv("RESET_HARD_REDIS_DISPOSABLE", "yes");
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

  it("fails closed without the disposable-endpoint authorisation", async () => {
    const server = await startMockRedisServer("+OK\r\n");
    configureRedis(server.port);
    vi.stubEnv("RESET_HARD_REDIS_DISPOSABLE", "");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(/RESET_HARD_REDIS_DISPOSABLE/);
  });

  it("fails loud when REDIS_URL omits an explicit port", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1");
    vi.stubEnv("RESET_HARD_REDIS_DISPOSABLE", "yes");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(
      /REDIS_URL must include an explicit port/,
    );
  });

  it("fails loud when neither REDIS_URL nor REDIS_PORT pins a port", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("REDIS_HOST", "127.0.0.1");
    vi.stubEnv("REDIS_PORT", "");
    vi.stubEnv("RESET_HARD_REDIS_DISPOSABLE", "yes");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(
      /REDIS_PORT must be set in \.env/,
    );
  });

  it("accepts REDIS_URL with an explicit port", async () => {
    const server = await startMockRedisServer("+OK\r\n");
    vi.stubEnv("REDIS_URL", `redis://127.0.0.1:${server.port}`);
    vi.stubEnv("RESET_HARD_REDIS_DISPOSABLE", "yes");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).resolves.toBeUndefined();
  });
});

describe("quotePgIdentifier", () => {
  it("doubles embedded quotes", () => {
    expect(quotePgIdentifier('we"ird')).toBe('"we""ird"');
  });

  it("wraps plain identifiers unchanged", () => {
    expect(quotePgIdentifier("report_section")).toBe('"report_section"');
  });

  it("escapes hostile catalog names", () => {
    expect(quotePgIdentifier('x"); DROP TABLE users; --')).toBe(
      '"x""); DROP TABLE users; --"',
    );
  });
});
