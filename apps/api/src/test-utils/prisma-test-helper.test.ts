import { afterEach, describe, expect, it, vi } from "vitest";

const { poolConstructor } = vi.hoisted(() => ({
  poolConstructor: vi.fn(),
}));

vi.mock("pg", () => ({ default: { Pool: poolConstructor } }));

import {
  assertTestDatabaseUrl,
  cleanDatabase,
  createTestPrisma,
} from "./prisma-test-helper";

afterEach(() => {
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
      assertTestDatabaseUrl(
        "postgresql://u:p@localhost:5432/customreport_e2e_lane_a_test",
        { NODE_ENV: "test" },
      ),
    ).toThrow(/must equal/iu);
  });

  it("rejects an unsafe target before allocating a pg pool", () => {
    vi.stubEnv(
      "E2E_DATABASE_URL",
      "postgresql://u:p@db.example.com:5432/arbitrary_test",
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
