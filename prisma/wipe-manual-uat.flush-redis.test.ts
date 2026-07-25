import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { flushRedisDb } from "./wipe-manual-uat.js";

interface MockRedisServer {
  readonly port: number;
  close(): Promise<void>;
}

const openServers = new Set<MockRedisServer>();

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

function configureRedis(port: number): void {
  vi.stubEnv("MANUAL_UAT_WIPE_FLUSH_REDIS", "true");
  vi.stubEnv("REDIS_HOST", "127.0.0.1");
  vi.stubEnv("REDIS_PORT", String(port));
}

// Fail fast if the flush waits on the 5s production timeout.
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
    openServers.delete(server);
    configureRedis(closedPort);

    const result = await settlePromptly(flushRedisDb());
    expect(result.flushed).toBe(false);
    if (result.flushed) throw new Error("expected a failed flush");
    expect(result.reason).toContain("ECONNREFUSED");
  });
});
