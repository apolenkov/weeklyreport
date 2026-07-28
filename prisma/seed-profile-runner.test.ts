import { describe, expect, it } from "vitest";

import { parseSeedProfile } from "./seed-profile-contract.js";
import { seedStepsFor } from "./seed-profile-runner.js";

describe("seed profile execution plan", () => {
  it("maps minimal and demo to one wiping base writer", () => {
    expect(seedStepsFor("minimal")).toEqual([
      { script: "seed-minimal.ts", args: [] },
    ]);
    expect(seedStepsFor("demo")).toEqual([
      { script: "seed-simple.ts", args: [] },
    ]);
  });

  it("extends demo for full and full for stress", () => {
    expect(seedStepsFor("full")).toEqual([
      ...seedStepsFor("demo"),
      { script: "seed.ts", args: [] },
    ]);
    expect(seedStepsFor("stress")).toEqual([
      ...seedStepsFor("full"),
      { script: "seed-stress-overlay.ts", args: [] },
    ]);
  });

  it("rejects an invalid profile before a plan can be selected", () => {
    expect(() => seedStepsFor(parseSeedProfile(undefined))).toThrow(
      "Seed profile is missing",
    );
  });
});
