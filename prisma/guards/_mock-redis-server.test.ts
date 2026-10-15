import { once } from "node:events";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { expect, it } from "vitest";

import { startMockRedisServer } from "./_mock-redis-server.js";

it("replies once per complete command when SELECT arrives in fragments", async () => {
  const select = "*2\r\n$6\r\nSELECT\r\n$2\r\n15\r\n";
  const flush = "*1\r\n$7\r\nFLUSHDB\r\n";
  const prefix = select.slice(0, 12);
  const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
  const client = net.createConnection({ host: "127.0.0.1", port: server.port });
  let replies = "";
  let ended = false;
  let socketError: Error | undefined;
  client.on("data", (chunk: Buffer) => {
    replies += chunk.toString("utf8");
  });
  client.on("end", () => {
    ended = true;
  });
  client.on("error", (error) => {
    socketError = error;
  });
  try {
    client.write(prefix);
    await expect.poll(() => server.receivedData()).toBe(prefix);
    // The peer has received this fragment before the suffix is sent.
    await delay(50);
    expect(replies).toBe("");
    client.write(select.slice(prefix.length));
    await expect.poll(() => replies).toBe("+OK\r\n");
    expect(ended).toBe(false);
    client.write(flush);
    await expect.poll(() => ended).toBe(true);
    expect(replies).toBe("+OK\r\n+OK\r\n");
    expect(server.receivedData()).toBe(select + flush);
    expect(socketError).toBeUndefined();
  } finally {
    client.destroy();
    await server.close();
  }
});

it("replies to both commands written together before closing", async () => {
  const server = await startMockRedisServer(["+OK\r\n", "+OK\r\n"]);
  const client = net.createConnection({ host: "127.0.0.1", port: server.port });
  let replies = "";
  client.on("data", (chunk: Buffer) => {
    replies += chunk.toString("utf8");
  });
  try {
    const closed = once(client, "close");
    const commands =
      "*2\r\n$6\r\nSELECT\r\n$2\r\n15\r\n*1\r\n$7\r\nFLUSHDB\r\n";
    client.write(commands);
    await closed;
    expect(server.receivedData()).toBe(commands);
    expect(replies).toBe("+OK\r\n+OK\r\n");
  } finally {
    client.destroy();
    await server.close();
  }
});

it("closes a non-array request without a scripted reply", async () => {
  const server = await startMockRedisServer("+OK\r\n");
  const client = net.createConnection({ host: "127.0.0.1", port: server.port });
  let replies = "";
  client.on("data", (chunk: Buffer) => {
    replies += chunk.toString("utf8");
  });
  try {
    const closed = once(client, "close");
    client.write("PING\r\n");
    await closed;
    expect(server.receivedData()).toBe("PING\r\n");
    expect(replies).toBe("");
  } finally {
    client.destroy();
    await server.close();
  }
});
