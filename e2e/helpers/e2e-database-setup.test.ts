import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  E2eDatabaseSetupError,
  e2eSetupCommands,
  setupE2eDatabase,
} from "./e2e-database-setup.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("E2E database setup", () => {
  it("builds a deterministic reset then named-profile plan", () => {
    const repoRoot = path.join("workspace", "customreport");

    expect(e2eSetupCommands(repoRoot, "stress")).toEqual([
      {
        executable: "pnpm",
        args: ["exec", "prisma", "migrate", "reset", "--force"],
      },
      {
        executable: process.execPath,
        args: [
          "--import",
          "tsx",
          path.join(repoRoot, "prisma/seed-profile.ts"),
          "stress",
        ],
      },
    ]);
  });

  it("rejects the developer database before running a command", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");

    expect(() =>
      setupE2eDatabase({
        databaseUrl: "postgresql://localhost/customreport_dev",
        profile: "full",
        repoRoot: "/unused",
      }),
    ).toThrow(E2eDatabaseSetupError);
  });
});
