import { describe, expect, it } from "vitest";

import { runtimeLaneDatabaseUrl } from "./runtime-lane-readiness.ts";

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
