import { describe, expect, it } from "vitest";

import {
  assertRuntimeLaneDatabaseReadiness,
  assertRuntimeLaneRedisReadiness,
  runtimeLaneDatabaseUrl,
} from "./runtime-lane-readiness.ts";

describe("runtime lane database URL", () => {
  it("rebinds only the database name on a loopback URL", () => {
    expect(
      runtimeLaneDatabaseUrl(
        "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
        "customreport_e2e_lane_a_test",
      ),
    ).toBe(
      "postgresql://user:secret@127.0.0.1:5432/customreport_e2e_lane_a_test",
    );
  });

  it("rejects a non-loopback database host", () => {
    expect(() =>
      runtimeLaneDatabaseUrl(
        "postgresql://user:secret@db.internal/customreport_e2e",
        "customreport_e2e_lane_a_test",
      ),
    ).toThrow(/loopback/u);
  });
});

describe("runtime lane quiescence", () => {
  it("rejects a database with a foreign client", () => {
    expect(() =>
      assertRuntimeLaneDatabaseReadiness(
        {
          activeClients: 1,
          database: "customreport_e2e_lane_a_test",
        },
        "customreport_e2e_lane_a_test",
      ),
    ).toThrow(/foreign client/u);
  });

  it.each([
    { keyCount: 0, normalClients: 2, runId: "redis-a" },
    { keyCount: 1, normalClients: 1, runId: "redis-a" },
  ])("rejects non-quiescent Redis state %#", (readiness) => {
    expect(() => assertRuntimeLaneRedisReadiness(readiness, 6381)).toThrow(
      /(foreign client|stale key)/u,
    );
  });
});
