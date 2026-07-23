import { describe, expect, it } from "vitest";

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
});
