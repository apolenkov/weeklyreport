import assert from "node:assert";
import test from "node:test";

import { E2E_DESTRUCTIVE_CONSENT } from "../../prisma/guards/_destructive-guard.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

function baseEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    E2E_DATABASE_URL:
      "postgresql://e2e_user:e2e_placeholder@127.0.0.1:5432/customreport_e2e",
    DATABASE_URL:
      "postgresql://app_user:app_placeholder@127.0.0.1:5432/customreport_e2e",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: E2E_DESTRUCTIVE_CONSENT,
    REDIS_DB: "15",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "6379",
    ...overrides,
  };
}

function expectRejection(env: NodeJS.ProcessEnv, includes: string): void {
  assert.throws(
    () => validateE2eRuntimeTarget("runtime-target-test", env),
    (error: unknown) => {
      assert(error instanceof Error);
      assert(
        error.message.includes(includes),
        `Expected message to include "${includes}", got: ${error.message}`,
      );
      assert(
        !error.message.includes("e2e_placeholder") &&
          !error.message.includes("app_placeholder"),
        "Error message must not expose credentials",
      );
      return true;
    },
  );
}

void test("accepts loopback customreport_e2e with different credentials", () => {
  const result = validateE2eRuntimeTarget("runtime-target-test", baseEnv());
  assert.strictEqual(result.redisDb, "15");
  assert.strictEqual(result.redisHost, "127.0.0.1");
  assert.strictEqual(result.redisPort, 6379);
  assert.strictEqual(result.consentToken, E2E_DESTRUCTIVE_CONSENT);
});

void test("accepts ::1 loopback", () => {
  const url = "postgresql://u:p@[::1]:5432/customreport_e2e";
  const result = validateE2eRuntimeTarget(
    "runtime-target-test",
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
  );
  assert.strictEqual(result.redisHost, "127.0.0.1");
});

void test("accepts localhost", () => {
  const url = "postgresql://u:p@localhost:5432/customreport_e2e";
  const result = validateE2eRuntimeTarget(
    "runtime-target-test",
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
  );
  assert.strictEqual(result.redisHost, "127.0.0.1");
});

void test("rejects all authorized lane names", () => {
  for (const lane of "abcdefghijklmno".split("")) {
    const url = `postgresql://u:p@127.0.0.1:5432/customreport_e2e_lane_${lane}_test`;
    expectRejection(
      baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
      "customreport_e2e",
    );
  }
});

void test("E2E_LANE selects the lane database and its own Redis DB", () => {
  for (const [lane, redisDb] of [
    ["a", "1"],
    ["b", "2"],
  ] as const) {
    const url = `postgresql://u:p@127.0.0.1:5432/customreport_e2e_lane_${lane}_test`;
    const result = validateE2eRuntimeTarget(
      "runtime-target-test",
      baseEnv({
        E2E_LANE: lane,
        E2E_DATABASE_URL: url,
        DATABASE_URL: url,
        REDIS_DB: redisDb,
      }),
    );
    assert.strictEqual(result.redisDb, redisDb);
  }
});

void test("a lane never accepts another lane's database or Redis DB", () => {
  const laneB = "postgresql://u:p@127.0.0.1:5432/customreport_e2e_lane_b_test";
  expectRejection(
    baseEnv({
      E2E_LANE: "a",
      E2E_DATABASE_URL: laneB,
      DATABASE_URL: laneB,
      REDIS_DB: "2",
    }),
    "customreport_e2e_lane_a_test",
  );
  expectRejection(baseEnv({ E2E_LANE: "b" }), "customreport_e2e_lane_b_test");
  const laneA = "postgresql://u:p@127.0.0.1:5432/customreport_e2e_lane_a_test";
  expectRejection(
    baseEnv({
      E2E_LANE: "a",
      E2E_DATABASE_URL: laneA,
      DATABASE_URL: laneA,
      REDIS_DB: "15",
    }),
    "REDIS_DB must be exactly 1",
  );
});

void test("rejects wrong database name", () => {
  const url = "postgresql://u:p@127.0.0.1:5432/customreport_test";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "is not one of",
  );
});

void test("rejects normalized database path", () => {
  const url = "postgresql://u:p@127.0.0.1:5432/other/../customreport_e2e";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "exact literal segment without normalization",
  );
});

void test("rejects encoded database path", () => {
  const url = "postgresql://u:p@127.0.0.1:5432/customreport%5Fe2e";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "exact, unencoded path segment",
  );
});

void test("rejects query delimiter", () => {
  const url =
    "postgresql://u:p@127.0.0.1:5432/customreport_e2e?sslmode=disable";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "query or fragment delimiters",
  );
});

void test("rejects fragment delimiter", () => {
  const url = "postgresql://u:p@127.0.0.1:5432/customreport_e2e#anchor";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "query or fragment delimiters",
  );
});

void test("rejects remote hosts", () => {
  const url = "postgresql://u:p@192.168.1.1:5432/customreport_e2e";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "is not loopback",
  );
});

void test("rejects unbracketed IPv6 loopback", () => {
  const url = "postgresql://u:p@::1:5432/customreport_e2e";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "IPv6 hosts must use brackets",
  );
});

void test("rejects malformed URL", () => {
  const url = "not-a-url";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "not a parseable PostgreSQL URL",
  );
});

void test("rejects wrong protocol", () => {
  const url = "mysql://u:p@127.0.0.1:5432/customreport_e2e";
  expectRejection(
    baseEnv({ E2E_DATABASE_URL: url, DATABASE_URL: url }),
    "must use the postgres or postgresql protocol",
  );
});

void test("rejects mismatched database", () => {
  expectRejection(
    baseEnv({
      DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/customreport_e2e_other",
    }),
    "same database target",
  );
});

void test("rejects mismatched host", () => {
  expectRejection(
    baseEnv({
      DATABASE_URL: "postgresql://u:p@127.0.0.2:5432/customreport_e2e",
    }),
    "same database target",
  );
});

void test("rejects mismatched port", () => {
  expectRejection(
    baseEnv({
      DATABASE_URL: "postgresql://u:p@127.0.0.1:5433/customreport_e2e",
    }),
    "same database target",
  );
});

void test("rejects missing E2E_DATABASE_URL", () => {
  expectRejection(baseEnv({ E2E_DATABASE_URL: undefined }), "E2E_DATABASE_URL");
});

void test("rejects missing DATABASE_URL", () => {
  expectRejection(baseEnv({ DATABASE_URL: undefined }), "DATABASE_URL");
});

void test("rejects missing consent token", () => {
  expectRejection(
    baseEnv({ PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: undefined }),
    "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION",
  );
});

void test("rejects wrong consent token", () => {
  expectRejection(
    baseEnv({ PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes" }),
    "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION",
  );
});

void test("rejects production NODE_ENV variants", () => {
  for (const variant of ["production", "PRODUCTION", "Production"]) {
    expectRejection(baseEnv({ NODE_ENV: variant }), "NODE_ENV=production");
  }
});

void test("rejects REDIS_DB other than 15", () => {
  expectRejection(baseEnv({ REDIS_DB: "0" }), "REDIS_DB");
});

void test("rejects REDIS_DB with leading zero", () => {
  expectRejection(baseEnv({ REDIS_DB: "015" }), "REDIS_DB");
});

void test("rejects missing REDIS_DB", () => {
  expectRejection(baseEnv({ REDIS_DB: undefined }), "REDIS_DB");
});

void test("rejects remote REDIS_HOST", () => {
  expectRejection(
    baseEnv({ REDIS_HOST: "redis.example.com" }),
    "loopback address",
  );
});

void test("rejects missing REDIS_HOST", () => {
  expectRejection(baseEnv({ REDIS_HOST: undefined }), "REDIS_HOST");
});

void test("rejects REDIS_PORT zero", () => {
  expectRejection(baseEnv({ REDIS_PORT: "0" }), "REDIS_PORT");
});

void test("rejects REDIS_PORT negative", () => {
  expectRejection(baseEnv({ REDIS_PORT: "-1" }), "REDIS_PORT");
});

void test("rejects REDIS_PORT leading zero", () => {
  expectRejection(baseEnv({ REDIS_PORT: "01234" }), "REDIS_PORT");
});

void test("rejects REDIS_PORT overflow", () => {
  expectRejection(baseEnv({ REDIS_PORT: "70000" }), "REDIS_PORT");
});

void test("rejects non-decimal REDIS_PORT", () => {
  expectRejection(baseEnv({ REDIS_PORT: "abc" }), "REDIS_PORT");
});

void test("rejects missing REDIS_PORT", () => {
  expectRejection(baseEnv({ REDIS_PORT: undefined }), "REDIS_PORT");
});
