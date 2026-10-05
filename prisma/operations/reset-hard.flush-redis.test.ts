import net from "node:net";

import { describe, expect, it, vi } from "vitest";

const pgMock = vi.hoisted(() => ({ Pool: vi.fn() }));
vi.mock("pg", () => ({ default: pgMock }));

import {
  registerMockRedisTeardown,
  settlePromptly,
  startMockRedisServer,
} from "../guards/_mock-redis-server.js";

// Loads the reset script without depending on a developer database setting.
async function loadResetHard(): Promise<typeof import("./reset-hard.js")> {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:test@127.0.0.1:5432/customreport_e2e",
  );
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  return import("./reset-hard.js");
}

async function loadFlushRedis(): Promise<
  typeof import("./reset-hard.js").flushRedis
> {
  const { flushRedis } = await loadResetHard();
  return flushRedis;
}

// Re-points the stubbed DATABASE_URL at another database name.
function useDatabase(name: string): void {
  const url = process.env.DATABASE_URL ?? "";
  vi.stubEnv("DATABASE_URL", url.slice(0, url.lastIndexOf("/") + 1) + name);
}

function configureRedis(port: number): void {
  vi.stubEnv("REDIS_HOST", "127.0.0.1");
  vi.stubEnv("REDIS_PORT", String(port));
  vi.stubEnv("REDIS_DB", "15");
}

registerMockRedisTeardown();

describe("flushRedis", () => {
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
    const flushRedis = await loadFlushRedis();
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@127.0.0.1:5432/customreport_dev",
    );
    try {
      await expect(flushRedis()).rejects.toThrow(/not one of/u);
      expect(connections).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects an unsafe database before constructing a Prisma pool", async () => {
    const { runResetHard } = await loadResetHard();
    const originalProfile = process.argv[2];
    process.argv[2] = "full";
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@127.0.0.1:5432/customreport_dev",
    );
    try {
      await expect(runResetHard()).rejects.toThrow(/not one of/u);
      expect(pgMock.Pool).not.toHaveBeenCalled();
    } finally {
      process.argv.splice(
        2,
        1,
        ...(originalProfile === undefined ? [] : [originalProfile]),
      );
    }
  });

  it("resolves after an observed +OK reply", async () => {
    const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
    configureRedis(server.port);
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).resolves.toBeUndefined();
    expect(server.receivedData()).toContain("SELECT");
    expect(server.receivedData()).toContain("FLUSHDB");
  });

  it("rejects a replyless close promptly", async () => {
    const server = await startMockRedisServer(undefined);
    configureRedis(server.port);
    const flushRedis = await loadFlushRedis();

    await expect(settlePromptly(flushRedis())).rejects.toThrow(
      "Redis SELECT 15 + FLUSHDB: connection closed before both replies were received",
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

  it("fails closed unless the reserved Redis database is selected", async () => {
    const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
    configureRedis(server.port);
    vi.stubEnv("REDIS_DB", "0");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(/REDIS_DB must be exactly 15/);
  });

  it("never sends FLUSHDB when SELECT 15 is rejected", async () => {
    const server = await startMockRedisServer("-ERR invalid DB index\r\n");
    configureRedis(server.port);
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(/SELECT 15 failed/);
    expect(server.receivedData()).toContain("SELECT");
    expect(server.receivedData()).not.toContain("FLUSHDB");
  });

  it("fails loud when REDIS_PORT is absent", async () => {
    vi.stubEnv("REDIS_HOST", "127.0.0.1");
    vi.stubEnv("REDIS_PORT", "");
    vi.stubEnv("REDIS_DB", "15");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(/REDIS_PORT must be set/);
  });
});

describe("quotePgIdentifier", () => {
  it("doubles embedded quotes", async () => {
    const { quotePgIdentifier } = await loadResetHard();
    expect(quotePgIdentifier('we"ird')).toBe('"we""ird"');
  });

  it("wraps plain identifiers unchanged", async () => {
    const { quotePgIdentifier } = await loadResetHard();
    expect(quotePgIdentifier("report_section")).toBe('"report_section"');
  });

  it("escapes hostile catalog names", async () => {
    const { quotePgIdentifier } = await loadResetHard();
    expect(quotePgIdentifier('x"); DROP TABLE users; --')).toBe(
      '"x""); DROP TABLE users; --"',
    );
  });
});

describe("flushRedis Redis DB per target database", () => {
  it("flushes only the lane's own Redis DB", async () => {
    const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
    configureRedis(server.port);
    const flushRedis = await loadFlushRedis();
    useDatabase("customreport_e2e_lane_b_test");
    vi.stubEnv("REDIS_DB", "2");

    await expect(flushRedis()).resolves.toBeUndefined();
    expect(server.receivedData()).toContain("SELECT\r\n$1\r\n2\r\n");
  });

  it.each(["0", "13", "14", "15", "1"])(
    "refuses lane b with REDIS_DB %s before connecting",
    async (redisDb) => {
      const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
      configureRedis(server.port);
      const flushRedis = await loadFlushRedis();
      useDatabase("customreport_e2e_lane_b_test");
      vi.stubEnv("REDIS_DB", redisDb);

      await expect(flushRedis()).rejects.toThrow(/REDIS_DB must be exactly 2/);
      expect(server.receivedData()).toBe("");
    },
  );

  it("refuses customreport_e2e on a lane's Redis DB", async () => {
    const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
    configureRedis(server.port);
    vi.stubEnv("REDIS_DB", "2");
    const flushRedis = await loadFlushRedis();

    await expect(flushRedis()).rejects.toThrow(/REDIS_DB must be exactly 15/);
  });

  it("refuses a lane without an assigned Redis DB", async () => {
    configureRedis(1);
    const flushRedis = await loadFlushRedis();
    useDatabase("customreport_e2e_lane_m_test");

    await expect(flushRedis()).rejects.toThrow(/no Redis DB assigned/);
  });
});
