import { afterEach, describe, expect, it, vi } from "vitest";

const pgMock = vi.hoisted(() => ({
  Pool: vi.fn<new () => { end: () => Promise<void> }>(),
}));
const prismaMock = vi.hoisted(() => ({
  PrismaClient: vi.fn<new () => { $disconnect: () => Promise<void> }>(),
  PrismaPg: vi.fn(),
}));
const childProcessMock = vi.hoisted(() => ({ spawnSync: vi.fn() }));

vi.mock("pg", () => ({ default: pgMock }));
vi.mock("@prisma/client", () => ({
  PrismaClient: prismaMock.PrismaClient,
}));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: prismaMock.PrismaPg }));
vi.mock("node:child_process", () => ({
  spawnSync: childProcessMock.spawnSync,
}));

// Regression: runResetHard must never print credential material from
// DATABASE_URL. The colon-containing password below is the fixture that
// defeated naive masking; no part of it may reach console output.
const COLON_PASSWORD_PREFIX = "hunter2";
const COLON_PASSWORD_SUFFIX = "extra";
const COLON_PASSWORD_URL =
  `postgresql://test:${COLON_PASSWORD_PREFIX}:${COLON_PASSWORD_SUFFIX}` +
  "@127.0.0.1:5432/customreport_e2e";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("runResetHard logging", () => {
  it("does not leak a colon-containing DATABASE_URL password into console output", async () => {
    const poolEnd = vi.fn().mockResolvedValue(undefined);
    pgMock.Pool.mockImplementation(
      class {
        end = poolEnd;
      },
    );
    const disconnect = vi.fn().mockResolvedValue(undefined);
    prismaMock.PrismaClient.mockImplementation(
      class {
        $disconnect = disconnect;
        $executeRawUnsafe = vi.fn().mockResolvedValue(0);
        $queryRawUnsafe = vi.fn().mockResolvedValue([]);
      },
    );
    // Fail the migration spawn so the run aborts before any truncate, Redis
    // flush, or seed side effect — the log under test happens before it.
    childProcessMock.spawnSync.mockReturnValue({ status: 1 });

    const consoleOutput: string[] = [];
    for (const method of ["log", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleOutput.push(args.map(String).join(" "));
      });
    }

    vi.stubEnv("DATABASE_URL", COLON_PASSWORD_URL);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    const originalProfile = process.argv[2];
    process.argv[2] = "minimal";
    try {
      const { runResetHard } = await import("./reset-hard.js");
      await expect(runResetHard()).rejects.toThrow(
        "prisma migrate deploy failed with exit code 1",
      );

      // Reached the guarded path: pool/client built, migration is the only
      // spawn, and both cleanup promises ran on the way out.
      expect(pgMock.Pool).toHaveBeenCalledWith({
        connectionString: COLON_PASSWORD_URL,
      });
      expect(childProcessMock.spawnSync).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(poolEnd).toHaveBeenCalledTimes(1);

      const rendered = consoleOutput.join("\n");
      expect(rendered).not.toContain(COLON_PASSWORD_PREFIX);
      expect(rendered).not.toContain(COLON_PASSWORD_SUFFIX);
    } finally {
      process.argv.splice(
        2,
        1,
        ...(originalProfile === undefined ? [] : [originalProfile]),
      );
    }
  });
});
