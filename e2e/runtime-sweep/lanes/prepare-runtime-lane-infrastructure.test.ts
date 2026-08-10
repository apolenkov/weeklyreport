import { describe, expect, it } from "vitest";

import {
  runtimeLaneRedisContainerName,
  runtimeLaneRedisRunArgs,
} from "./prepare-runtime-lane-infrastructure.ts";
import { runtimeLaneResources } from "./runtime-lane-contract.ts";

describe("runtime lane infrastructure contract", () => {
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
});
