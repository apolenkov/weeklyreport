import { describe, expect, it } from "vitest";

import { compareBySeverityThenName } from "./status-order";

describe("compareBySeverityThenName", () => {
  it("orders Blocked, At risk, On track, then no updates, names breaking ties", () => {
    const rows = [
      { status: "empty", name: "Alpha" },
      { status: "on-track", name: "Бета" },
      { status: "blocked", name: "Zeta" },
      { status: "on-track", name: "Альфа" },
      { status: "at-risk", name: "Gamma" },
    ] as const;
    expect(
      rows.toSorted(compareBySeverityThenName).map(({ name }) => name),
    ).toEqual(["Zeta", "Gamma", "Альфа", "Бета", "Alpha"]);
  });
});
