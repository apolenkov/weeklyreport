import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const command = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFileSync: command.execute }));

import {
  E2eDatabaseSetupError,
  e2eSetupCommands,
  setupE2eDatabase,
} from "./e2e-database-setup.js";

beforeEach(() => {
  command.execute.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("E2E database setup", () => {
  it("builds a deterministic reset then named-profile plan", () => {
    const repoRoot = path.join("workspace", "customreport");

    expect(e2eSetupCommands(repoRoot, "stress", "schema+seed")).toEqual([
      {
        executable: "pnpm",
        args: ["exec", "prisma", "migrate", "reset", "--force"],
      },
      {
        executable: process.execPath,
        args: [
          "--import",
          "tsx",
          path.join(repoRoot, "prisma/seeds/profiles/seed-profile.ts"),
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
        mode: "schema+seed",
      }),
    ).toThrow(E2eDatabaseSetupError);
  });

  it("rejects the developer database when credentials and query differ", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://developer:secret@localhost/customreport_dev?schema=public",
    );

    expect(() =>
      setupE2eDatabase({
        databaseUrl:
          "postgresql://runner:other@127.0.0.1:5432/customreport_dev?pool=2",
        profile: "full",
        repoRoot: "/unused",
        mode: "schema+seed",
      }),
    ).toThrow(E2eDatabaseSetupError);
  });

  it.each([
    "postgresql://runner@[::1]/customreport_dev",
    "postgresql://runner@localhost./customreport_dev",
    "postgresql://runner@127.1.2.3/customreport_dev",
    "postgresql://runner@127.1/customreport_dev",
    "postgresql://runner@2130706433/customreport_dev",
    "postgresql://runner@0177.0.0.1/customreport_dev",
    "postgresql://runner@0x7f000001/customreport_dev",
    "postgresql://runner@[0:0:0:0:0:0:0:1]/customreport_dev",
    "postgresql://runner@[::ffff:127.0.0.1]/customreport_dev",
    "postgresql://runner@devbox.local/customreport_dev",
  ])("rejects a local alias of the developer database: %s", (databaseUrl) => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");

    expect(() =>
      setupE2eDatabase({
        databaseUrl,
        profile: "full",
        repoRoot: "/unused",
        mode: "schema+seed",
      }),
    ).toThrow(E2eDatabaseSetupError);
  });

  it("guards the effective E2E target before running a command", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");

    expect(() =>
      setupE2eDatabase({
        databaseUrl: "postgresql://db.example.com/customreport",
        profile: "full",
        repoRoot: "/unused",
        mode: "schema+seed",
      }),
    ).toThrow(/Host "db\.example\.com" is not local/u);
  });

  it("does not let the production override bypass the E2E target guard", () => {
    vi.stubEnv("ALLOW_PROD_DESTRUCTIVE", "yes");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");

    expect(() =>
      setupE2eDatabase({
        databaseUrl: "postgresql://localhost/customreport_prod",
        profile: "full",
        repoRoot: "/unused",
        mode: "schema+seed",
      }),
    ).toThrow(/looks like production/u);
  });

  it.each([
    "http://localhost/customreport_test",
    "postgresql://localhost/%70roduction_test",
    "postgresql://localhost/customreport_test?host=db.example.com",
  ])("rejects a strict target bypass before spawning: %s", (databaseUrl) => {
    vi.stubEnv("ALLOW_PROD_DESTRUCTIVE", "yes");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");

    expect(() =>
      setupE2eDatabase({
        databaseUrl,
        profile: "full",
        repoRoot: "/unused",
        mode: "schema+seed",
      }),
    ).toThrow();
    expect(command.execute).not.toHaveBeenCalled();
  });

  it("keeps a profile-only reseed data-only", () => {
    const repoRoot = path.join("workspace", "customreport");

    expect(e2eSetupCommands(repoRoot, "stress", "profile-reseed")).toEqual([
      {
        executable: process.execPath,
        args: [
          "--import",
          "tsx",
          path.join(repoRoot, "prisma/seeds/profiles/seed-profile.ts"),
          "stress",
        ],
      },
    ]);
  });
});
