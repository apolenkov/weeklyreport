import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("dotenv", () => ({ config: vi.fn() }));
const socketMock = vi.hoisted(() => ({
  createConnection: vi.fn(() => {
    throw new Error("Unexpected socket access in an offline producer check");
  }),
}));
vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:net")>();
  return { ...actual, default: { ...actual, ...socketMock }, ...socketMock };
});
beforeEach(() => vi.clearAllMocks());

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

function offlineClient(queryRows: { tablename: string }[] = []) {
  const end = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const execute = vi
    .fn<(sql: string) => Promise<number>>()
    .mockResolvedValue(0);
  pgMock.Pool.mockImplementation(
    class {
      end = end;
    },
  );
  prismaMock.PrismaClient.mockImplementation(
    class {
      $disconnect = disconnect;
      $executeRawUnsafe = execute;
      $queryRawUnsafe = vi.fn().mockResolvedValue(queryRows);
    },
  );
  vi.stubEnv("DATABASE_URL", COLON_PASSWORD_URL);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  return { end, disconnect, execute };
}

it("retains a genuine OS ENOENT through the public hard-reset producer", async () => {
  const actual =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );
  const result = actual.spawnSync("/f09-no-such-executable", [], {
    shell: false,
    timeout: 1000,
    stdio: "pipe",
  });
  expect(result.status).toBeNull();
  expect(result.signal).toBeNull();
  expect(result.error?.message).toContain("ENOENT");
  const client = offlineClient();
  childProcessMock.spawnSync.mockReturnValue(result);
  const { runResetHard } = await import("./reset-hard.js");
  const previousArgv = process.argv;
  process.argv = [process.execPath, "synthetic-reset.ts", "minimal"];
  let failure: unknown;
  try {
    await runResetHard();
  } catch (error) {
    failure = error;
  } finally {
    process.argv = previousArgv;
  }
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error)) throw new Error("Expected producer failure");
  expect(failure.message).toContain("migrate deploy");
  expect(failure.message).toContain("ENOENT");
  expect(failure.cause).toBe(result.error);
  expect(client.end).toHaveBeenCalledOnce();
  expect(client.disconnect).toHaveBeenCalledOnce();
  expect(client.execute).not.toHaveBeenCalled();
  expect(socketMock.createConnection).not.toHaveBeenCalled();
});

it("emits qualified public table identities and stops before any socket access", async () => {
  const queryRows = [{ tablename: "Item" }, { tablename: 'strange"table' }];
  const client = offlineClient(queryRows);
  const stopBeforeRedis = new Error("Synthetic SQL transport stop");
  client.execute.mockRejectedValue(stopBeforeRedis);
  childProcessMock.spawnSync.mockReturnValue({ status: 0, signal: null });
  const { runResetHard } = await import("./reset-hard.js");
  const previousArgv = process.argv;
  process.argv = [process.execPath, "synthetic-reset.ts", "minimal"];
  try {
    await expect(runResetHard()).rejects.toBe(stopBeforeRedis);
  } finally {
    process.argv = previousArgv;
  }
  expect(client.execute).toHaveBeenCalledWith(
    'TRUNCATE TABLE "public"."Item", "public"."strange""table" RESTART IDENTITY CASCADE;',
  );
  expect(socketMock.createConnection).not.toHaveBeenCalled();
  expect(childProcessMock.spawnSync).toHaveBeenCalledOnce();
  expect(client.disconnect).toHaveBeenCalledOnce();
  expect(client.end).toHaveBeenCalledOnce();
});
