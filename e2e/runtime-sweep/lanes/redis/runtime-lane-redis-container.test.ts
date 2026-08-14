import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RuntimeLaneResource,
  runtimeLaneResources,
} from "../contracts/runtime-lane-contract.ts";
import {
  recreateRuntimeLaneRedisInfrastructure,
  runtimeLaneRedisContainerName,
  runtimeLaneRedisRunArgs,
} from "./runtime-lane-redis-container.ts";

const inspectionShape = (
  resource: RuntimeLaneResource,
  id: string,
  image: string,
  running = true,
) => ({
  Id: id,
  Name: `/${runtimeLaneRedisContainerName(resource.laneId)}`,
  Config: {
    Image: image,
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

const canonicalInspection = (
  resource: RuntimeLaneResource,
  id: string,
  running = true,
): ReturnType<typeof inspectionShape> =>
  inspectionShape(
    resource,
    id,
    runtimeLaneRedisRunArgs(resource)[8] ?? "missing-image",
    running,
  );

const laneA = (): RuntimeLaneResource => {
  const resource = runtimeLaneResources(1)[0];
  if (resource === undefined) throw new Error("Expected lane a");
  return resource;
};

describe("runtime lane Redis recreation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://user:secret@127.0.0.1/customreport_e2e",
    );
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["", "false", "TRUE"])(
    "rejects Redis mutation authorization %j before any Docker mutation",
    async (value) => {
      vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", value);
      const resource = laneA();
      const execute = vi.fn(() => Promise.resolve(""));
      const names = vi.fn(() => Promise.resolve([]));

      await expect(
        recreateRuntimeLaneRedisInfrastructure([resource], {
          names,
          inspect: vi.fn(),
          execute,
          wait: vi.fn(() => Promise.resolve()),
        }),
      ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
      expect(names).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("rejects missing Redis mutation authorization before any Docker mutation", async () => {
    delete process.env.RUNTIME_SWEEP_REDIS_RECREATE;
    const resource = laneA();
    const execute = vi.fn(() => Promise.resolve(""));
    const names = vi.fn(() => Promise.resolve([]));

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names,
        inspect: vi.fn(),
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(names).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("removes the proven immutable id even when the canonical name can rebound", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const previous = canonicalInspection(resource, "c".repeat(64));
    const recreated = canonicalInspection(resource, "e".repeat(64));
    const execute = vi.fn((args: readonly string[]) =>
      Promise.resolve(args[0] === "run" ? recreated.Id : ""),
    );
    const inspect = vi
      .fn()
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(recreated);
    const result = await recreateRuntimeLaneRedisInfrastructure([resource], {
      names: vi.fn(() => Promise.resolve([name])),
      inspect,
      execute,
      wait: vi.fn(() => Promise.resolve()),
    });

    expect(execute.mock.calls).toEqual([
      [["rm", "--force", "--volumes", previous.Id]],
      [[...runtimeLaneRedisRunArgs(resource)]],
    ]);
    expect(inspect.mock.calls).toEqual([[name], [recreated.Id]]);
    expect(result).toEqual(new Map([[resource.laneId, recreated.Id]]));
  });

  it("does not execute Docker mutations for an unproven container", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const execute = vi.fn(() => Promise.resolve(""));

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names: vi.fn(() => Promise.resolve([name])),
        inspect: vi.fn(() =>
          Promise.resolve(
            inspectionShape(resource, "c".repeat(64), "redis:latest"),
          ),
        ),
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/canonical resource tuple/u);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects recreation when Docker returns the previous identity", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const inspection = canonicalInspection(resource, "c".repeat(64));

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names: vi.fn(() => Promise.resolve([name])),
        inspect: vi.fn(() => Promise.resolve(inspection)),
        execute: vi.fn((args: readonly string[]) =>
          Promise.resolve(args[0] === "run" ? inspection.Id : ""),
        ),
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/identity did not change/u);
  });

  it("rejects a created id that differs from the exact inspected object", async () => {
    const resource = laneA();
    const createdId = "e".repeat(64);
    const foreign = canonicalInspection(resource, "f".repeat(64));
    const inspect = vi.fn(() => Promise.resolve(foreign));

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names: vi.fn(() => Promise.resolve([])),
        inspect,
        execute: vi.fn(() => Promise.resolve(createdId)),
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/does not match its creation result/u);
    expect(inspect).toHaveBeenLastCalledWith(createdId);
  });

  it("rejects non-canonical docker run stdout before inspection", async () => {
    const resource = laneA();
    const inspect = vi.fn();

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names: vi.fn(() => Promise.resolve([])),
        inspect,
        execute: vi.fn(() => Promise.resolve("short-id\n")),
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).rejects.toThrow(/invalid container identity/u);
    expect(inspect).not.toHaveBeenCalled();
  });

  it("removes an exact stopped canonical container by id before recreation", async () => {
    const resource = laneA();
    const name = runtimeLaneRedisContainerName(resource.laneId);
    const previous = canonicalInspection(resource, "c".repeat(64), false);
    const recreated = canonicalInspection(resource, "e".repeat(64));
    const execute = vi.fn((args: readonly string[]) =>
      Promise.resolve(args[0] === "run" ? recreated.Id : ""),
    );

    await expect(
      recreateRuntimeLaneRedisInfrastructure([resource], {
        names: vi.fn(() => Promise.resolve([name])),
        inspect: vi
          .fn()
          .mockResolvedValueOnce(previous)
          .mockResolvedValueOnce(recreated),
        execute,
        wait: vi.fn(() => Promise.resolve()),
      }),
    ).resolves.toEqual(new Map([[resource.laneId, recreated.Id]]));
    expect(execute).toHaveBeenNthCalledWith(1, [
      "rm",
      "--force",
      "--volumes",
      previous.Id,
    ]);
  });

  it("re-proves every lane after a partial multi-lane failure", async () => {
    const [laneOne, laneTwo] = runtimeLaneResources(2);
    if (laneOne === undefined || laneTwo === undefined)
      throw new Error("Expected lanes a and b");
    const nameOne = runtimeLaneRedisContainerName(laneOne.laneId);
    const nameTwo = runtimeLaneRedisContainerName(laneTwo.laneId);
    const oldOne = canonicalInspection(laneOne, "a".repeat(64));
    const oldTwo = canonicalInspection(laneTwo, "b".repeat(64));
    const firstOne = canonicalInspection(laneOne, "c".repeat(64));
    const partialTwo = canonicalInspection(laneTwo, "d".repeat(64), false);
    const retryOne = canonicalInspection(laneOne, "e".repeat(64));
    const retryTwo = canonicalInspection(laneTwo, "f".repeat(64));
    const names = vi
      .fn()
      .mockResolvedValueOnce([nameOne])
      .mockResolvedValueOnce([nameTwo])
      .mockResolvedValueOnce([nameOne])
      .mockResolvedValueOnce([nameTwo]);
    const inspect = vi
      .fn()
      .mockResolvedValueOnce(oldOne)
      .mockResolvedValueOnce(firstOne)
      .mockResolvedValueOnce(oldTwo)
      .mockResolvedValueOnce(firstOne)
      .mockResolvedValueOnce(retryOne)
      .mockResolvedValueOnce(partialTwo)
      .mockResolvedValueOnce(retryTwo);
    const execute = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(firstOne.Id)
      .mockResolvedValueOnce("")
      .mockRejectedValueOnce(new Error("docker run interrupted"))
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(retryOne.Id)
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(retryTwo.Id);
    const dependencies = {
      names,
      inspect,
      execute,
      wait: vi.fn(() => Promise.resolve()),
    };

    await expect(
      recreateRuntimeLaneRedisInfrastructure([laneOne, laneTwo], dependencies),
    ).rejects.toThrow(/interrupted/u);
    await expect(
      recreateRuntimeLaneRedisInfrastructure([laneOne, laneTwo], dependencies),
    ).resolves.toEqual(
      new Map([
        [laneOne.laneId, retryOne.Id],
        [laneTwo.laneId, retryTwo.Id],
      ]),
    );
    expect(execute.mock.calls).toEqual([
      [["rm", "--force", "--volumes", oldOne.Id]],
      [[...runtimeLaneRedisRunArgs(laneOne)]],
      [["rm", "--force", "--volumes", oldTwo.Id]],
      [[...runtimeLaneRedisRunArgs(laneTwo)]],
      [["rm", "--force", "--volumes", firstOne.Id]],
      [[...runtimeLaneRedisRunArgs(laneOne)]],
      [["rm", "--force", "--volumes", partialTwo.Id]],
      [[...runtimeLaneRedisRunArgs(laneTwo)]],
    ]);
  });
});
