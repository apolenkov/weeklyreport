import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
  type RuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";

describe("runtime lane Redis mutation authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "", "false", "TRUE"])(
    "rejects non-exact environment value %j",
    (value) => {
      vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", value);

      expect(() => requireRuntimeLaneRedisRecreationAuthorization()).toThrow(
        /RUNTIME_SWEEP_REDIS_RECREATE=true/u,
      );
    },
  );

  it("rejects a caller-fabricated capability", () => {
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const fabricated = Object.freeze({
      source: "RUNTIME_SWEEP_REDIS_RECREATE",
      value: "true",
    }) as RuntimeLaneRedisRecreationAuthorization;

    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(fabricated),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
  });

  it("consumes each exact capability only once", () => {
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const authorization = requireRuntimeLaneRedisRecreationAuthorization();

    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).not.toThrow();
    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
  });

  it("permanently revokes a real capability when the environment changes", () => {
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const authorization = requireRuntimeLaneRedisRecreationAuthorization();
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");

    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
  });
});
