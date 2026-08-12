import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runtimeLaneResources } from "./runtime-lane-contract.ts";
import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";
import {
  recreateRuntimeLaneRedisInfrastructure,
  runtimeLaneRedisContainerName,
  runtimeLaneRedisRunArgs,
} from "./runtime-lane-redis-container.ts";

describe("runtime lane Redis recreation authorization timing", () => {
  beforeEach(() => vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it("rechecks authorization after inspection before remove", async () => {
    const resource = runtimeLaneResources(1)[0];
    if (resource === undefined) throw new Error("Expected lane a");
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const inspection = {
      Id: "c".repeat(64),
      Name: `/${name}`,
      Config: {
        Image: runtimeLaneRedisRunArgs(resource)[8] ?? "missing-image",
        Cmd: ["redis-server", "--save", "", "--appendonly", "no"],
        Entrypoint: ["docker-entrypoint.sh"],
        Labels: { "customreport.runtime-sweep-lane": resource.laneId },
      },
      HostConfig: {
        NetworkMode: "bridge",
        PortBindings: {
          "6379/tcp": [
            { HostIp: "127.0.0.1", HostPort: String(resource.redisPort) },
          ],
        },
        RestartPolicy: { MaximumRetryCount: 0, Name: "no" },
      },
      Mounts: [
        {
          Destination: "/data",
          Driver: "local",
          Name: "d".repeat(64),
          RW: true,
          Type: "volume",
        },
      ],
      State: { Running: true },
    };
    const execute = vi.fn(() => Promise.resolve(""));

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names: vi.fn(() => Promise.resolve([name])),
        inspect: vi.fn(() => {
          vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");
          return Promise.resolve(inspection);
        }),
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps an observed revoked capability from reaching remove", async () => {
    const resource = runtimeLaneResources(1)[0];
    if (resource === undefined) throw new Error("Expected lane a");
    const authorization = requireRuntimeLaneRedisRecreationAuthorization();
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");
    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const execute = vi.fn(() => Promise.resolve(""));

    await expect(
      recreateRuntimeLaneRedisInfrastructure(
        [resource],
        {
          names: vi.fn(() =>
            Promise.resolve([runtimeLaneRedisContainerName(resource.laneId)]),
          ),
          inspect: vi.fn(),
          execute,
          wait: vi.fn(() => Promise.resolve()),
        },
        authorization,
      ),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(execute).not.toHaveBeenCalled();
  });
});
