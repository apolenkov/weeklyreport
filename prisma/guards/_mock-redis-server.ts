// Shared loopback Redis peer for the flush specs.

import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, vi } from "vitest";

export interface MockRedisServer {
  readonly port: number;
  receivedData(): string;
  close(): Promise<void>;
}

const openServers = new Set<MockRedisServer>();

function readLength(buffer: Buffer, offset: number, prefix: string) {
  if (offset >= buffer.length) return undefined;
  if (buffer[offset] !== prefix.charCodeAt(0))
    throw new Error("Expected a RESP command array of bulk strings");
  const end = buffer.indexOf("\r\n", offset);
  if (end === -1) return undefined;
  const digits = buffer.subarray(offset + 1, end).toString("ascii");
  const length = Number(digits);
  if (!/^\d+$/u.test(digits) || !Number.isSafeInteger(length))
    throw new Error("Invalid RESP command length");
  return { length, next: end + 2 };
}

function commandLength(buffer: Buffer): number | undefined {
  const array = readLength(buffer, 0, "*");
  if (array === undefined) return undefined;
  if (array.length === 0) throw new Error("Empty RESP command");
  let offset = array.next;
  for (let index = 0; index < array.length; index += 1) {
    const bulk = readLength(buffer, offset, "$");
    if (bulk === undefined) return undefined;
    const end = bulk.next + bulk.length;
    if (end + 2 > buffer.length) return undefined;
    if (buffer.subarray(end, end + 2).toString("ascii") !== "\r\n")
      throw new Error("Invalid RESP command terminator");
    offset = end + 2;
  }
  return offset;
}

// Starts a loopback Redis peer that returns one reply per received command.
// `undefined` means close without answering that command.
export async function startMockRedisServer(
  reply: string | undefined | readonly (string | undefined)[],
): Promise<MockRedisServer> {
  const sockets = new Set<Socket>();
  const replies: readonly (string | undefined)[] =
    typeof reply === "string" || reply === undefined ? [reply] : reply;
  let received = Buffer.alloc(0);
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
    let replyIndex = 0;
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      pending = Buffer.concat([pending, chunk]);
      try {
        let length = commandLength(pending);
        while (length !== undefined) {
          pending = pending.subarray(length);
          const nextReply = replies[replyIndex++];
          if (nextReply === undefined) {
            socket.end();
            return;
          }
          if (replyIndex >= replies.length) {
            socket.end(nextReply);
            return;
          }
          socket.write(nextReply);
          length = commandLength(pending);
        }
      } catch {
        // A malformed request must fail the caller, not consume a scripted OK.
        socket.destroy();
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
    receivedData: () => received.toString("utf8"),
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
