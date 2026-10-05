import { describe, expect, it } from "vitest";

import { assertRedisDbMatchesDatabase } from "./e2e-redis-target";

const urlFor = (database: string): string =>
  `postgresql://user:pw@127.0.0.1:5432/${database}`;

describe("assertRedisDbMatchesDatabase", () => {
  it.each([
    ["customreport_e2e", 15],
    ["customreport_e2e_lane_a_test", 1],
    ["customreport_e2e_lane_b_test", "2"],
  ])("accepts the Redis DB assigned to %s", (database, redisDb) => {
    expect(() => {
      assertRedisDbMatchesDatabase("test", urlFor(database), redisDb);
    }).not.toThrow();
  });

  it.each([
    ["customreport_e2e", 1],
    ["customreport_e2e_lane_a_test", 15],
    ["customreport_e2e_lane_a_test", 0],
  ])("rejects a mismatched Redis DB for %s (%s)", (database, redisDb) => {
    expect(() => {
      assertRedisDbMatchesDatabase("test", urlFor(database), redisDb);
    }).toThrow(/REDIS_DB must be exactly/u);
  });
});
