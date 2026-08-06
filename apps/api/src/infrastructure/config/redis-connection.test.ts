import { describe, expect, it } from "vitest";

import type { EnvConfig } from "./env.schema";
import {
  buildFailOpenRedisConnectionOptions,
  buildRedisConnectionOptions,
} from "./redis-connection";

describe("buildRedisConnectionOptions", () => {
  it("returns the validated host and port unchanged", () => {
    const env = { REDIS_HOST: "redis", REDIS_PORT: 6379 } as EnvConfig;

    expect(buildRedisConnectionOptions(env)).toEqual({
      host: "redis",
      port: 6379,
    });
  });
});

describe("buildFailOpenRedisConnectionOptions", () => {
  it("queues the first lazy command only for the bounded connection window", () => {
    const env = { REDIS_HOST: "redis", REDIS_PORT: 6379 } as EnvConfig;

    expect(buildFailOpenRedisConnectionOptions(env)).toEqual({
      host: "redis",
      port: 6379,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      commandTimeout: 2000,
    });
    expect(buildFailOpenRedisConnectionOptions(env)).not.toHaveProperty(
      "enableOfflineQueue",
    );
  });
});
