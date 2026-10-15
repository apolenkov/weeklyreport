import { lookup } from "node:dns/promises";

import { Redis } from "ioredis";
import { describe, expect, it } from "vitest";

import { buildFailOpenRedisConnectionOptions } from "../infrastructure/config/redis-connection";

// C2139: the unit contour must not reach a developer's or CI's real Redis, even
// when a unit test builds a real client from the defaults instead of a mock.
const UNROUTABLE = /\.invalid$/u;

function unitRedisEnv() {
  const { REDIS_HOST, REDIS_PORT, REDIS_DB } = process.env;
  if (!REDIS_HOST || !REDIS_PORT || !REDIS_DB) {
    throw new Error(
      "Unit setup must provide REDIS_HOST, REDIS_PORT and REDIS_DB",
    );
  }
  return {
    REDIS_HOST,
    REDIS_PORT: Number(REDIS_PORT),
    REDIS_DB: Number(REDIS_DB),
  };
}

describe("unit Redis defaults", () => {
  it("name a host that cannot resolve", async () => {
    const { REDIS_HOST } = unitRedisEnv();

    expect(REDIS_HOST).toMatch(UNROUTABLE);
    await expect(lookup(REDIS_HOST)).rejects.toMatchObject({
      code: "ENOTFOUND",
    });
  });

  it("make a real client fail before any command reaches a server", async () => {
    const env = unitRedisEnv();
    // Checked first so a routable default is never contacted by this test.
    expect(env.REDIS_HOST).toMatch(UNROUTABLE);
    const client = new Redis({
      ...buildFailOpenRedisConnectionOptions(env),
      retryStrategy: () => null,
    });
    const errors: unknown[] = [];
    client.on("error", (error: unknown) => errors.push(error));
    try {
      await expect(client.ping()).rejects.toThrow();
      expect(errors).toContainEqual(
        expect.objectContaining({ code: "ENOTFOUND" }),
      );
    } finally {
      client.disconnect();
    }
  });
});
