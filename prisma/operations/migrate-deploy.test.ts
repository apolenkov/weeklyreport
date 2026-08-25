import { describe, expect, it, vi } from "vitest";

import { runMigrateDeploy } from "./migrate-deploy.js";

const environment = {
  DATABASE_URL:
    "postgresql://customreport:secret@127.0.0.1:5432/customreport_e2e_lane_a_test",
  NODE_ENV: "test",
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
} as const;

describe("migrate deploy boundary", () => {
  it.each([
    "postgresql://customreport:secret@127.0.0.1:5432/customreport_dev",
    "postgresql://customreport:secret@db.internal:5432/customreport_e2e_lane_a_test",
  ])("rejects unsafe targets before spawning Prisma: %s", (databaseUrl) => {
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    expect(() =>
      runMigrateDeploy({ ...environment, DATABASE_URL: databaseUrl }, spawn),
    ).toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("rejects missing consent before spawning Prisma", () => {
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    expect(() =>
      runMigrateDeploy(
        { ...environment, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "" },
        spawn,
      ),
    ).toThrow(/must equal/u);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("spawns only the guarded exact deploy command", () => {
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    runMigrateDeploy(environment, spawn);
    expect(spawn).toHaveBeenCalledWith(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      expect.objectContaining({ shell: false, stdio: "inherit" }),
    );
  });
});
