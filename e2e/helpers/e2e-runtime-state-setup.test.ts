import { beforeEach, describe, expect, it, vi } from "vitest";

import { reseedE2eRuntimeState } from "./e2e-runtime-state-setup.ts";

const harness = vi.hoisted(() => ({
  databaseReseed: vi.fn(() => undefined),
  redisReset: vi.fn(() => Promise.resolve()),
}));

vi.mock("./e2e-database-setup.js", () => ({
  reseedE2eDatabase: harness.databaseReseed,
}));

vi.mock("./e2e-redis-setup.js", () => ({
  resetE2eRedis: harness.redisReset,
}));

beforeEach(() => {
  harness.databaseReseed.mockClear();
  harness.redisReset.mockClear();
});

describe("E2E runtime state reseed", () => {
  it("restores durable state before clearing transient state", async () => {
    const input = {
      databaseUrl: "postgresql://localhost/customreport_e2e",
      profile: "minimal" as const,
      repoRoot: "/workspace/customreport",
    };

    await reseedE2eRuntimeState(input);

    expect(harness.databaseReseed).toHaveBeenCalledExactlyOnceWith(input);
    expect(harness.redisReset).toHaveBeenCalledOnce();
    expect(harness.databaseReseed.mock.invocationCallOrder[0]).toBeLessThan(
      harness.redisReset.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    );
  });

  it("fails before Redis reset when the database reseed fails", async () => {
    harness.databaseReseed.mockImplementationOnce(() => {
      throw new Error("database reseed failed");
    });

    await expect(
      reseedE2eRuntimeState({
        databaseUrl: "postgresql://localhost/customreport_e2e",
        profile: "minimal",
        repoRoot: "/workspace/customreport",
      }),
    ).rejects.toThrow("database reseed failed");

    expect(harness.redisReset).not.toHaveBeenCalled();
  });
});
