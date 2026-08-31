// Shared loopback Redis peer for the flush specs. Not a suite: vitest.prisma
// config only collects `prisma/*.test.ts`.

import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, vi } from "vitest";

export interface MockRedisServer {
  readonly port: number;
  receivedData(): string;
  close(): Promise<void>;
}

const openServers = new Set<MockRedisServer>();

// Starts a loopback Redis peer that returns one reply per received command.
// `undefined` means close without answering that command.
export async function startMockRedisServer(
  reply: string | undefined | readonly (string | undefined)[],
): Promise<MockRedisServer> {
  const sockets = new Set<Socket>();
  const replies: readonly (string | undefined)[] =
    typeof reply === "string" || reply === undefined ? [reply] : reply;
  let received = "";
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
    let replyIndex = 0;
    socket.on("data", (chunk: unknown) => {
      const data = Buffer.isBuffer(chunk)
        ? chunk.toString("utf8")
        : String(chunk);
      received += data;
      const nextReply = replies[replyIndex];
      replyIndex += 1;
      if (nextReply === undefined) {
        socket.end();
      } else if (replyIndex >= replies.length) {
        socket.end(nextReply);
      } else {
        socket.write(nextReply);
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
    receivedData: () => received,
    async close() {
      // Self-deregistering and idempotent, so a spec may close a server early
      // to free its port and the teardown still runs cleanly.
      openServers.delete(mockServer);
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

// Well under the 5s production socket timeout, so a flush that falls back to it
// fails the spec instead of stalling the run.
const SETTLE_DEADLINE_MS = 1000;

// Fail fast if the flush waits on the production timeout.
export function settlePromptly<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    delay(SETTLE_DEADLINE_MS, undefined, { ref: false }).then(() => {
      throw new Error("Redis flush did not settle within one second");
    }),
  ]);
}

// Called once per spec file so the hook registers in that file's collection
// context rather than as an import side effect.
export function registerMockRedisTeardown(): void {
  afterEach(async () => {
    const servers = [...openServers];
    openServers.clear();
    await Promise.all(servers.map((server) => server.close()));
    vi.unstubAllEnvs();
  });
}
