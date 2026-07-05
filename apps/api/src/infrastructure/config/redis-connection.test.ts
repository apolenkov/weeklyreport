import { afterEach, describe, expect, it } from "vitest";

import type { EnvConfig } from "./env.schema";
import { buildRedisConnectionOptions } from "./redis-connection";

describe("buildRedisConnectionOptions", () => {
  it("returns the validated host and port unchanged", () => {
    const env = { REDIS_HOST: "redis", REDIS_PORT: 6379 } as EnvConfig;

    expect(buildRedisConnectionOptions(env)).toEqual({
      host: "redis",
      port: 6379,
    });
  });

  describe("with process.env poisoned to different values", () => {
    const originalHost = process.env.REDIS_HOST;
    const originalPort = process.env.REDIS_PORT;

    afterEach(() => {
      if (originalHost === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = originalHost;
      if (originalPort === undefined) delete process.env.REDIS_PORT;
      else process.env.REDIS_PORT = originalPort;
    });

    it("reads only the passed EnvConfig, never process.env", () => {
      process.env.REDIS_HOST = "wrong-host";
      process.env.REDIS_PORT = "1111";
      const env = { REDIS_HOST: "redis", REDIS_PORT: 6379 } as EnvConfig;

      expect(buildRedisConnectionOptions(env)).toEqual({
        host: "redis",
        port: 6379,
      });
    });
  });
});
