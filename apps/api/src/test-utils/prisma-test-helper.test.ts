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
  const sharedUrl = "postgresql://u:p@localhost:5432/customreport_e2e";
  const consent = {
    NODE_ENV: "test",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
    DATABASE_URL: sharedUrl,
  } as const;

  it.each([
    [sharedUrl, sharedUrl],
    [
      "postgresql://integration:secret@localhost:5432/customreport_e2e",
      "postgres://developer:other@127.0.0.1:5432/customreport_e2e",
    ],
    [
      "postgres://u:p@[::1]:5432/customreport_e2e",
      "postgresql://u:p@localhost:5432/customreport_e2e",
    ],
    [
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
    ],
  ] as const)(
    "accepts both URLs resolving to one logical target: %s vs %s",
    (e2eUrl, developerUrl) => {
      expect(() =>
        assertTestDatabaseUrl(e2eUrl, {
          ...consent,
          DATABASE_URL: developerUrl,
        }),
      ).not.toThrow();
    },
  );

  it.each([
    "postgresql://user:pass@db.example.com:5432/arbitrary_test",
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
      assertTestDatabaseUrl(sharedUrl, {
        NODE_ENV: "test",
        DATABASE_URL: sharedUrl,
      }),
    ).toThrow(/must equal/iu);
  });

  it.each([undefined, ""])(
    "requires an explicit developer target (%s)",
    (developerUrl) => {
      expect(() =>
        assertTestDatabaseUrl(sharedUrl, {
          NODE_ENV: "test",
          PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
            consent.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION,
          ...(developerUrl === undefined ? {} : { DATABASE_URL: developerUrl }),
        }),
      ).toThrow(/DATABASE_URL.*required/iu);
    },
  );

  it.each([
    [
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
      "postgresql://u:p@localhost:5432/customreport_e2e",
    ],
    [
      "postgresql://u:p@localhost:5432/customreport_e2e",
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_b_test",
    ],
    [
      "postgresql://u:p@localhost:5433/customreport_e2e",
      "postgresql://u:p@localhost:5432/customreport_e2e",
    ],
  ] as const)(
    "rejects divergent logical targets: %s vs %s",
    (e2eUrl, developerUrl) => {
      expect(() =>
        assertTestDatabaseUrl(e2eUrl, {
          ...consent,
          DATABASE_URL: developerUrl,
        }),
      ).toThrow(/same database target/iu);
    },
  );

  it.each([
    {
      developerUrl: "postgresql://u:p@db.example.com:5432/customreport_e2e",
      reason: /not loopback/iu,
    },
    { developerUrl: "not-a-postgres-url", reason: /not a parseable/iu },
  ])(
    "rejects an unsafe developer target: $developerUrl",
    ({ developerUrl, reason }) => {
      expect(() =>
        assertTestDatabaseUrl(sharedUrl, {
          ...consent,
          DATABASE_URL: developerUrl,
        }),
      ).toThrow(reason);
    },
  );

  it.each([undefined, ""])(
    "refuses cleanup when the developer target is unknown (%s)",
    async (developerUrl) => {
      vi.stubEnv("DATABASE_URL", developerUrl);
      vi.stubEnv("E2E_DATABASE_URL", sharedUrl);
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

      await expect(cleanDatabase()).rejects.toThrow(/DATABASE_URL.*required/iu);
      expect(poolConstructor).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
      expect(executeRawUnsafe).not.toHaveBeenCalled();
    },
  );

  it("rejects an unsafe target before allocating a pg pool or running SQL", async () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@db.example.com:5432/arbitrary_test",
    );
    vi.stubEnv("DATABASE_URL", sharedUrl);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    expect(() => createTestPrisma()).toThrow(/not loopback/iu);
    await expect(cleanDatabase()).rejects.toThrow(/not loopback/iu);
    expect(poolConstructor).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects production before allocating a pg pool or running SQL", async () => {
    vi.stubEnv("E2E_DATABASE_URL", sharedUrl);
    vi.stubEnv("DATABASE_URL", sharedUrl);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    await expect(cleanDatabase()).rejects.toThrow(/production/iu);
    expect(poolConstructor).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects a divergent target before allocating a pg pool or running SQL", async () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
    );
    vi.stubEnv("DATABASE_URL", sharedUrl);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    expect(() => createTestPrisma()).toThrow(/same database target/iu);
    await expect(cleanDatabase()).rejects.toThrow(/same database target/iu);
    expect(poolConstructor).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects missing consent before discovering or truncating tables", async () => {
    vi.stubEnv("E2E_DATABASE_URL", sharedUrl);
    vi.stubEnv("DATABASE_URL", sharedUrl);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "");
    await expect(cleanDatabase()).rejects.toThrow(/must equal/iu);
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it("reuses the memoized client for an alias-spelled equal target", () => {
    vi.stubEnv("E2E_DATABASE_URL", sharedUrl);
    vi.stubEnv("DATABASE_URL", sharedUrl);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    const client = createTestPrisma();
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgres://other:creds@127.0.0.1:5432/customreport_e2e",
    );
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@[::1]:5432/customreport_e2e");

    expect(createTestPrisma()).toBe(client);
    expect(poolConstructor).toHaveBeenCalledTimes(1);
  });

  it("rejects target drift before reusing a client or truncating", async () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://integration:secret@localhost:5432/customreport_e2e",
    );
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://developer:other@127.0.0.1:5432/customreport_e2e",
    );
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");

    createTestPrisma();
    // Both explicit envs move together so the matching-target check still
    // passes and the memoized-client drift check is what refuses the drift.
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@localhost:5433/customreport_e2e",
    );
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://u:p@localhost:5433/customreport_e2e",
    );

    expect(() => createTestPrisma()).toThrow(/different E2E database/iu);
    await expect(cleanDatabase()).rejects.toThrow(/different E2E database/iu);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("does not expose credentials in an unsafe-target diagnostic", () => {
    const url =
      "postgresql://secretuser:secretpass@db.example.com:5432/arbitrary_test";
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
