import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

interface MockRedisServer {
  readonly port: number;
  close(): Promise<void>;
}

const openServers = new Set<MockRedisServer>();

/** Loads the reset script without depending on a developer database setting. */
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

/** Starts a loopback Redis peer that replies after receiving one command. */
async function startMockRedisServer(
  reply: string | undefined,
): Promise<MockRedisServer> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
    socket.once("data", () => {
      if (reply === undefined) {
        socket.end();
      } else {
        socket.end(reply);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Mock Redis server did not bind a TCP port");
  }

  const mockServer: MockRedisServer = {
    port: address.port,
    async close() {
      for (const socket of sockets) socket.destroy();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
  openServers.add(mockServer);
  return mockServer;
}

/** Points the flush function at a test-owned loopback port. */
function configureRedis(port: number): void {
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("REDIS_HOST", "127.0.0.1");
  vi.stubEnv("REDIS_PORT", String(port));
}

/** Fails if the socket outcome waits for the five-second production timeout. */
function settlePromptly<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    delay(1000, undefined, { ref: false }).then(() => {
      throw new Error("Redis flush did not settle within one second");
    }),
  ]);
}

afterEach(async () => {
  const servers = [...openServers];
  openServers.clear();
  await Promise.all(servers.map((server) => server.close()));
  vi.unstubAllEnvs();
});

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
    openServers.delete(server);
    configureRedis(closedPort);
    const flushRedis = await loadFlushRedis();

    await expect(settlePromptly(flushRedis())).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });
  });
});
