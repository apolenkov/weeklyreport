import { afterEach, describe, expect, it, vi } from "vitest";

const {
  adapterConstructor,
  executeRawUnsafe,
  poolConstructor,
  prismaConstructor,
  queryRaw,
} = vi.hoisted(() => {
  const poolEnd = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const executeRawUnsafe = vi.fn().mockResolvedValue(0);
  const queryRaw = vi.fn();
  return {
    adapterConstructor: vi.fn(function AdapterMock() {
      return {};
    }),
    executeRawUnsafe,
    poolConstructor: vi.fn(function PoolMock() {
      return { end: poolEnd };
    }),
    prismaConstructor: vi.fn(function PrismaClientMock() {
      return {
        $disconnect: disconnect,
        $executeRawUnsafe: executeRawUnsafe,
        $queryRaw: queryRaw,
      };
    }),
    queryRaw,
  };
});

vi.mock("pg", () => ({ default: { Pool: poolConstructor } }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: adapterConstructor }));
vi.mock("@prisma/client", () => ({ PrismaClient: prismaConstructor }));

import {
  assertTestDatabaseUrl,
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "./prisma-test-helper";

afterEach(async () => {
  await disconnectTestPrisma();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("assertTestDatabaseUrl", () => {
  const consent = {
    NODE_ENV: "test",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
  } as const;

  it("accepts only an exact disposable loopback database", () => {
    expect(() =>
      assertTestDatabaseUrl(
        "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
        consent,
      ),
    ).not.toThrow();
  });

  it.each([
    "postgresql://user:pass@db.internal:5432/arbitrary_test",
    "postgresql://u:p@localhost:5432/customreport_test",
    "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test?schema=public",
  ])(
    "rejects a suffix-based or ambiguous target before allocation: %s",
    (url) => {
      expect(() => assertTestDatabaseUrl(url, consent)).toThrow();
    },
  );

  it("requires exact per-operation consent", () => {
    expect(() =>
      assertTestDatabaseUrl(
        "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
        { NODE_ENV: "test" },
      ),
    ).toThrow(/must equal/iu);
  });

  it("requires the integration target to differ from the developer target", () => {
    expect(() =>
      assertTestDatabaseUrl(
        "postgresql://integration:secret@localhost:5432/customreport_e2e",
        {
          ...consent,
          DATABASE_URL:
            "postgres://developer:other@127.0.0.1:5432/customreport_e2e",
        },
      ),
    ).toThrow(/must differ/iu);
  });

  it("rejects an unsafe target before allocating a pg pool", () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@db.internal:5432/arbitrary_test",
    );
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    expect(() => createTestPrisma()).toThrow(/not loopback/iu);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it("rejects missing consent before discovering or truncating tables", async () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
    );
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "");
    await expect(cleanDatabase()).rejects.toThrow(/must equal/iu);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it("rejects target drift before reusing a client or truncating", async () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
    );
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://u:p@localhost:5432/customreport_e2e",
    );
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    createTestPrisma();
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_b_test",
    );

    expect(() => createTestPrisma()).toThrow(/different E2E database/iu);
    await expect(cleanDatabase()).rejects.toThrow(/different E2E database/iu);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("does not expose credentials in an unsafe-target diagnostic", () => {
    const url =
      "postgresql://secretuser:secretpass@db.internal:5432/arbitrary_test";
    let caughtError: unknown;
    try {
      assertTestDatabaseUrl(url, consent);
    } catch (error: unknown) {
      caughtError = error;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect(String(caughtError)).not.toContain("secretpass");
  });
});
