import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runtimeLaneResources } from "./contracts/runtime-lane-contract.ts";
import { prepareRuntimeLaneInfrastructure } from "./prepare-runtime-lane-infrastructure.ts";
import {
  assertRuntimeLaneRedisContainer,
  prepareRuntimeLaneRedisContainer,
  runtimeLaneRedisContainerName,
  runtimeLaneRedisRunArgs,
} from "./redis/runtime-lane-redis-container.ts";

describe("runtime lane infrastructure contract", () => {
  beforeEach(() => {
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not bind Array.map arguments into Redis preparation parameters", async () => {
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const resources = runtimeLaneResources(2);
    const prepareRedis = vi.fn<typeof prepareRuntimeLaneRedisContainer>(() =>
      Promise.resolve("ready"),
    );

    await expect(
      prepareRuntimeLaneInfrastructure(
        {
          resources,
          baseDatabaseUrl:
            "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
        },
        {
          prepareDatabases: vi.fn(() => Promise.resolve(2)),
          prepareRedis,
        },
      ),
    ).resolves.toMatchObject({
      databasesCreated: 2,
      redisCreated: 0,
      redisStarted: 0,
      redisReady: 2,
    });
    expect(prepareRedis).toHaveBeenCalledTimes(2);
    expect(prepareRedis).toHaveBeenNthCalledWith(1, resources[0]);
    expect(prepareRedis).toHaveBeenNthCalledWith(2, resources[1]);
    vi.unstubAllEnvs();
  });

  it("derives a stable labeled loopback-only Redis container", () => {
    const resource = runtimeLaneResources(4)[3];
    if (resource === undefined) throw new Error("Expected lane d");

    expect(runtimeLaneRedisContainerName(resource.laneId)).toBe(
      "weeklyreport-runtime-lane-d-redis",
    );
    expect(runtimeLaneRedisRunArgs(resource)).toEqual([
      "run",
      "--detach",
      "--name",
      "weeklyreport-runtime-lane-d-redis",
      "--label",
      "customreport.runtime-sweep-lane=d",
      "--publish",
      "127.0.0.1:6384:6379",
      expect.stringMatching(/^redis:7-alpine@sha256:/u),
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
    ]);
  });

  it("keeps ten lane Redis resources distinct", () => {
    const resources = runtimeLaneResources(10);

    expect(
      new Set(
        resources.map(({ laneId }) => runtimeLaneRedisContainerName(laneId)),
      ).size,
    ).toBe(10);
    expect(new Set(resources.map(({ redisPort }) => redisPort)).size).toBe(10);
  });

  it("requires the complete canonical Redis container identity", () => {
    const resource = runtimeLaneResources(1)[0];
    if (resource === undefined) throw new Error("Expected lane a");
    const image = runtimeLaneRedisRunArgs(resource)[8];
    if (image === undefined) throw new Error("Expected pinned Redis image");
    const inspection = {
      Id: "c".repeat(64),
      Name: "/weeklyreport-runtime-lane-a-redis",
      Config: {
        Image: image,
        Cmd: ["redis-server", "--save", "", "--appendonly", "no"],
        Entrypoint: ["docker-entrypoint.sh"],
        Labels: { "customreport.runtime-sweep-lane": "a" },
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

    expect(() =>
      assertRuntimeLaneRedisContainer(resource, inspection),
    ).not.toThrow();
    [
      { ...inspection, Name: "/weeklyreport-runtime-lane-b-redis" },
      {
        ...inspection,
        Config: { ...inspection.Config, Image: "redis:latest" },
      },
      {
        ...inspection,
        Config: { ...inspection.Config, Cmd: ["redis-server", "--save", "60"] },
      },
      {
        ...inspection,
        HostConfig: {
          ...inspection.HostConfig,
          PortBindings: {
            "6379/tcp": [{ HostIp: "0.0.0.0", HostPort: "6381" }],
          },
        },
      },
      { ...inspection, Mounts: [] },
      { ...inspection, State: { Running: false } },
    ].forEach((candidate) => {
      expect(() =>
        assertRuntimeLaneRedisContainer(resource, candidate),
      ).toThrow(/canonical resource tuple/u);
    });
  });
});
