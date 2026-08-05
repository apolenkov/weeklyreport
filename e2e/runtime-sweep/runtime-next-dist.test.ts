import { describe, expect, it } from "vitest";

import {
  parseRuntimeNextLane,
  RUNTIME_NEXT_LANES,
  runtimeNextDistName,
  staleRuntimeNextDistNames,
} from "./runtime-next-dist.ts";

describe("runtime Next dist ownership", () => {
  it.each(RUNTIME_NEXT_LANES)("accepts %s", (lane) => {
    expect(parseRuntimeNextLane(lane)).toBe(lane);
  });

  it.each([undefined, ".next", "../.next", "other"])("rejects %s", (value) => {
    expect(() => parseRuntimeNextLane(value)).toThrow(
      "Unknown runtime Next lane",
    );
  });

  it("removes dead owners without touching live, current, or foreign dirs", () => {
    const ownerPid = 42;
    const livePid = 43;
    const deadPid = 44;
    const names = [
      runtimeNextDistName("sweep", ownerPid),
      runtimeNextDistName("sweep", livePid),
      runtimeNextDistName("sweep", deadPid),
      runtimeNextDistName("preflight", deadPid),
      ".next",
      ".next-runtime-sweep-not-a-pid",
    ];

    expect(
      staleRuntimeNextDistNames(
        names,
        "sweep",
        ownerPid,
        (pid) => pid === livePid,
      ),
    ).toEqual([runtimeNextDistName("sweep", deadPid)]);
  });
});
