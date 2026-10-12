import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runMigrateDeploy } from "./migrate-deploy.js";

const environment = {
  DATABASE_URL:
    "postgresql://customreport:secret@127.0.0.1:5432/customreport_e2e_lane_a_test",
  NODE_ENV: "test",
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it.each([
    "DATABASE_URL",
    "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION",
  ] as const)(
    "requires explicit input %s even when the ambient environment supplies it",
    (key) => {
      vi.stubEnv("DATABASE_URL", environment.DATABASE_URL);
      vi.stubEnv(
        "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION",
        environment.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION,
      );
      const { [key]: _omitted, ...input } = environment;
      const spawn = vi.fn(() => ({ status: 0, signal: null }));

      expect(() => runMigrateDeploy(input, spawn)).toThrow();
      expect(spawn).not.toHaveBeenCalled();
    },
  );

  it("rejects inherited production before spawning when the input omits NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { NODE_ENV: _omitted, ...input } = environment;
    const spawn = vi.fn(() => ({ status: 0, signal: null }));

    expect(() => runMigrateDeploy(input, spawn)).toThrow(
      /NODE_ENV=production/u,
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("passes the explicit non-production override to the child", () => {
    vi.stubEnv("NODE_ENV", "production");
    const childEnvironments: Pick<
      NodeJS.ProcessEnv,
      "NODE_ENV" | "DATABASE_URL"
    >[] = [];
    runMigrateDeploy(environment, (_command, _args, options) => {
      childEnvironments.push({
        NODE_ENV: options.env.NODE_ENV,
        DATABASE_URL: options.env.DATABASE_URL,
      });
      return { status: 0, signal: null };
    });

    expect(childEnvironments).toHaveLength(1);
    expect(childEnvironments[0]?.NODE_ENV).toBe("test");
    expect(childEnvironments[0]?.DATABASE_URL).toBe(environment.DATABASE_URL);
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

it("reports a genuine OS spawn failure and stops before another action", () => {
  const result = spawnSync("/f09-no-such-executable", [], {
    shell: false,
    timeout: 1000,
    stdio: "pipe",
  });
  expect(result.status).toBeNull();
  expect(result.signal).toBeNull();
  expect(result.error?.message).toContain("ENOENT");
  console.log("Synthetic OS receipt", {
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  const spawn = vi.fn(() => result);
  let failure: unknown;
  try {
    runMigrateDeploy(environment, spawn);
  } catch (error) {
    failure = error;
  }
  expect(spawn).toHaveBeenCalledOnce();
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error)) throw new Error("Expected producer failure");
  expect(failure.message).toContain("migrate deploy");
  expect(failure.message).toContain("ENOENT");
  expect(failure.cause).toBe(result.error);
});

it("preserves the actual signal from a bounded self-terminated Node child", () => {
  const result = spawnSync(
    process.execPath,
    ["-e", "process.kill(process.pid, 'SIGTERM')"],
    { shell: false, timeout: 5000, stdio: "pipe" },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBeNull();
  expect(result.signal).toBe("SIGTERM");
  console.log("Synthetic OS receipt", {
    status: result.status,
    signal: result.signal,
    error: result.error,
  });
  expect(() => runMigrateDeploy(environment, () => result)).toThrow("SIGTERM");
});

it("keeps context and cause when the spawn boundary itself throws", () => {
  const primary = new Error("Synthetic spawn boundary failure");
  let failure: unknown;
  try {
    runMigrateDeploy(environment, () => {
      throw primary;
    });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error))
    throw new Error("Expected contextual producer failure");
  expect(failure.message).toContain("migrate deploy");
  expect(failure.cause).toBe(primary);
});
