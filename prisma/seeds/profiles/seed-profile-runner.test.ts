import { spawnSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseSeedProfile } from "./seed-profile-contract.js";
import { runSeedProfile, seedStepsFor } from "./seed-profile-runner.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T23:59:59.000Z"));
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://synthetic:synthetic@127.0.0.1:5432/customreport_e2e",
  );
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  vi.stubEnv("SEED_REFERENCE_DATE", undefined);
  vi.mocked(spawnSync).mockReset();
  vi.mocked(spawnSync).mockReturnValue({
    status: 0,
    signal: null,
    pid: 0,
    output: [],
    stdout: "",
    stderr: "",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("seed profile execution plan", () => {
  it("maps minimal and demo to one wiping base writer", () => {
    expect(seedStepsFor("minimal")).toEqual([
      { script: "../minimal/seed-minimal.ts", args: [] },
    ]);
    expect(seedStepsFor("demo")).toEqual([
      { script: "../simple/seed-simple.ts", args: [] },
    ]);
  });

  it("extends demo for full and full for stress", () => {
    expect(seedStepsFor("full")).toEqual([
      ...seedStepsFor("demo"),
      { script: "../../seed.ts", args: [] },
    ]);
    expect(seedStepsFor("stress")).toEqual([
      ...seedStepsFor("full"),
      { script: "../stress/seed-stress-overlay.ts", args: [] },
    ]);
  });

  it("rejects an invalid profile before a plan can be selected", () => {
    expect(() => seedStepsFor(parseSeedProfile(undefined))).toThrow(
      "Seed profile is missing",
    );
  });
});

const childReferences = (): readonly unknown[] =>
  vi
    .mocked(spawnSync)
    .mock.calls.map((call) => call[2]?.env?.SEED_REFERENCE_DATE);

describe("public profile run reference", () => {
  it.each(["minimal", "demo", "full", "stress"] as const)(
    "pins one instant for every %s child across UTC Monday",
    (profile) => {
      vi.mocked(spawnSync).mockImplementation(() => {
        vi.setSystemTime(new Date("2026-10-12T00:00:01.000Z"));
        return {
          status: 0,
          signal: null,
          pid: 0,
          output: [],
          stdout: "",
          stderr: "",
        };
      });
      runSeedProfile(profile);
      expect(childReferences().length).toBeGreaterThan(1);
      expect(new Set(childReferences())).toEqual(
        new Set(["2026-10-11T23:59:59.000Z"]),
      );
      expect(process.env.SEED_REFERENCE_DATE).toBeUndefined();
    },
  );

  it("normalizes an explicit offset instant without changing the parent's raw value", () => {
    vi.stubEnv("SEED_REFERENCE_DATE", "2026-10-12T03:15:00+03:00");
    runSeedProfile("full");
    expect(new Set(childReferences())).toEqual(
      new Set(["2026-10-12T00:15:00.000Z"]),
    );
    expect(process.env.SEED_REFERENCE_DATE).toBe("2026-10-12T03:15:00+03:00");
  });

  it("rejects an invalid explicit instant before the first child", () => {
    vi.stubEnv("SEED_REFERENCE_DATE", "invalid synthetic instant");
    expect(() => runSeedProfile("demo")).toThrow(
      "SEED_REFERENCE_DATE must be an ISO 8601 instant",
    );
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("keeps a failed child and guard refusal from launching later steps", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      signal: null,
      pid: 0,
      output: [],
      stdout: "",
      stderr: "",
    });
    expect(() => runSeedProfile("full")).toThrow("failed for full");
    expect(spawnSync).toHaveBeenCalledOnce();
    vi.mocked(spawnSync).mockClear();
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "");
    expect(() => runSeedProfile("full")).toThrow();
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
