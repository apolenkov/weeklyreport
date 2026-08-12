import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RuntimeLaneResource,
  runtimeLaneResources,
} from "./runtime-lane-contract.ts";
import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";
import {
  prepareRuntimeLaneRedisContainer,
  runtimeLaneRedisContainerName,
  runtimeLaneRedisRunArgs,
} from "./runtime-lane-redis-container.ts";

const inspectionShape = (
  resource: RuntimeLaneResource,
  id: string,
  running = true,
) => ({
  Id: id,
  Name: `/${runtimeLaneRedisContainerName(resource.laneId)}`,
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
  State: { Running: running },
});

const laneA = (): RuntimeLaneResource => {
  const resource = runtimeLaneResources(1)[0];
  if (resource === undefined) throw new Error("Expected lane a");
  return resource;
};

describe("runtime lane Redis preparation", () => {
  beforeEach(() => {
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates only after waiting and inspecting the exact returned id", async () => {
    const resource = laneA();
    const createdId = "e".repeat(64);
    const events: string[] = [];
    const inspect = vi.fn(() => {
      events.push("inspect");
      return Promise.resolve(inspectionShape(resource, createdId));
    });
    const wait = vi.fn(() => {
      events.push("wait");
      return Promise.resolve();
    });
    const result = await prepareRuntimeLaneRedisContainer(resource, {
      names: vi.fn(() => Promise.resolve([])),
      inspect,
      execute: vi.fn(() => {
        events.push("run");
        return Promise.resolve(`${createdId}\n`);
      }),
      wait,
    });

    expect(result).toBe("created");
    expect(events).toEqual(["run", "wait", "inspect"]);
    expect(inspect).toHaveBeenCalledWith(createdId);
  });

  it("rejects invalid docker run stdout before inspection", async () => {
    const resource = laneA();
    const inspect = vi.fn();

    await expect(
      prepareRuntimeLaneRedisContainer(resource, {
        names: vi.fn(() => Promise.resolve([])),
        inspect,
        execute: vi.fn(() => Promise.resolve("short-id\n")),
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/invalid container identity/u);
    expect(inspect).not.toHaveBeenCalled();
  });

  it("rechecks authorization after discovery before create", async () => {
    const resource = laneA();
    const execute = vi.fn(() => Promise.resolve("e".repeat(64)));

    await expect(
      prepareRuntimeLaneRedisContainer(resource, {
        names: vi.fn(() => {
          vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");
          return Promise.resolve([]);
        }),
        inspect: vi.fn(),
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps an observed revoked capability stale after the environment is restored", async () => {
    const resource = laneA();
    const authorization = requireRuntimeLaneRedisRecreationAuthorization();
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");
    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const execute = vi.fn(() => Promise.resolve("e".repeat(64)));

    await expect(
      prepareRuntimeLaneRedisContainer(
        resource,
        {
          names: vi.fn(() => Promise.resolve([])),
          inspect: vi.fn(),
          execute,
          wait: vi.fn(() => Promise.resolve()),
        },
        authorization,
      ),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps the same revoked capability from reaching start", async () => {
    const resource = laneA();
    const authorization = requireRuntimeLaneRedisRecreationAuthorization();
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");
    expect(() =>
      consumeRuntimeLaneRedisRecreationAuthorization(authorization),
    ).toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
    const execute = vi.fn(() => Promise.resolve(""));

    await expect(
      prepareRuntimeLaneRedisContainer(
        resource,
        {
          names: vi.fn(() =>
            Promise.resolve([runtimeLaneRedisContainerName(resource.laneId)]),
          ),
          inspect: vi.fn(() =>
            Promise.resolve(inspectionShape(resource, "c".repeat(64), false)),
          ),
          execute,
          wait: vi.fn(() => Promise.resolve()),
        },
        authorization,
      ),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(execute).not.toHaveBeenCalled();
  });

  it("starts a stopped container by its exact inspected id and rechecks it", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const stopped = inspectionShape(resource, "c".repeat(64), false);
    const started = inspectionShape(resource, stopped.Id);
    const inspect = vi
      .fn()
      .mockResolvedValueOnce(stopped)
      .mockResolvedValueOnce(started);
    const execute = vi.fn(() => Promise.resolve(""));

    await expect(
      prepareRuntimeLaneRedisContainer(resource, {
        names: vi.fn(() => Promise.resolve([name])),
        inspect,
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).resolves.toBe("started");
    expect(execute).toHaveBeenCalledWith(["start", stopped.Id]);
    expect(inspect).toHaveBeenLastCalledWith(stopped.Id);
  });

  it("rechecks authorization after inspection before start", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const stopped = inspectionShape(resource, "c".repeat(64), false);
    const execute = vi.fn(() => Promise.resolve(""));

    await expect(
      prepareRuntimeLaneRedisContainer(resource, {
        names: vi.fn(() => Promise.resolve([name])),
        inspect: vi.fn(() => {
          vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "false");
          return Promise.resolve(stopped);
        }),
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ["foreign identity", inspectionShape(laneA(), "f".repeat(64))],
    ["non-running state", inspectionShape(laneA(), "c".repeat(64), false)],
  ])(
    "rejects a stopped container post-start when it has %s",
    async (_, postStart) => {
      const resource = laneA();
      const name = runtimeLaneRedisContainerName(resource.laneId);
      const stopped = inspectionShape(resource, "c".repeat(64), false);
      const inspect = vi
        .fn()
        .mockResolvedValueOnce(stopped)
        .mockResolvedValueOnce(postStart);

      await expect(
        prepareRuntimeLaneRedisContainer(resource, {
          names: vi.fn(() => Promise.resolve([name])),
          inspect,
          execute: vi.fn(() => Promise.resolve("")),
          wait: vi.fn(() => Promise.resolve()),
        }),
      ).rejects.toThrow(/canonical resource tuple|exact requested id/u);
    },
  );

  it("returns an existing ready container only after post-wait identity proof", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const execute = vi.fn(() => Promise.resolve(""));
    const id = "c".repeat(64);
    const inspect = vi
      .fn()
      .mockResolvedValueOnce(inspectionShape(resource, id))
      .mockResolvedValueOnce(inspectionShape(resource, id));

    await expect(
      prepareRuntimeLaneRedisContainer(resource, {
        names: vi.fn(() => Promise.resolve([name])),
        inspect,
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).resolves.toBe("ready");
    expect(execute).not.toHaveBeenCalled();
    expect(inspect).toHaveBeenLastCalledWith(id);
  });

  it.each([
    ["foreign identity", inspectionShape(laneA(), "f".repeat(64))],
    ["non-running state", inspectionShape(laneA(), "c".repeat(64), false)],
  ])(
    "rejects a ready container post-wait when it has %s",
    async (_, postWait) => {
      const resource = laneA();
      const name = runtimeLaneRedisContainerName(resource.laneId);
      const id = "c".repeat(64);
      const inspect = vi
        .fn()
        .mockResolvedValueOnce(inspectionShape(resource, id))
        .mockResolvedValueOnce(postWait);

      await expect(
        prepareRuntimeLaneRedisContainer(resource, {
          names: vi.fn(() => Promise.resolve([name])),
          inspect,
          execute: vi.fn(() => Promise.resolve("")),
          wait: vi.fn(() => Promise.resolve()),
        }),
      ).rejects.toThrow(/canonical resource tuple|exact requested id/u);
    },
  );
});
